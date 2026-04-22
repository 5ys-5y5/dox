import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import type { TemplateExtractPdfEmbeddedFont } from './templateExtractPdfRenderService';

const CHROME_BINARY_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const REMOTE_DEBUGGING_WS_PATTERN = /(ws:\/\/[^\s]+)/i;
const DEFAULT_VIEWPORT_WIDTH = 1400;
const DEFAULT_VIEWPORT_HEIGHT = 2000;
const DEFAULT_DEVICE_SCALE_FACTOR = 2;

type ChromeJsonRpcMessage = {
  id?: number;
  method?: string;
  params?: unknown;
  sessionId?: string;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
  };
};

type PageBox = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type RenderDocumentMetrics = {
  contentWidth: number;
  contentHeight: number;
  pages: PageBox[];
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export type TemplateExtractMeasuredTextRunInput = {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: string | number | null;
};

type TemplateExtractMeasuredTextRunOutput = {
  id: string;
  width: number;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const escapeHtml = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildEmbeddedFontFaceCss = (embeddedFonts: TemplateExtractPdfEmbeddedFont[] = []) =>
  embeddedFonts
    .map(
      (embeddedFont) => `@font-face {
        font-family: "${embeddedFont.cssFontFamily}";
        src: url("${embeddedFont.dataUrl}") format("truetype");
        font-style: normal;
        font-weight: ${embeddedFont.fontWeight || 400};
      }`
    )
    .join('\n');

const sanitizeMeasurementCss = (cssText: string) =>
  cssText
    .replace(/@import\s+(?:url\()?['"]?[^;]+;?/gi, '')
    .replace(/url\((['"]?)https?:\/\/[^)'"]+\1\)/gi, 'none');

const sanitizeMeasurementHtml = (rawHtml: string) =>
  rawHtml
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*?>/gi, '')
    .replace(/<(iframe|object|embed|video|audio)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<img\b[^>]*\bsrc=['"]https?:\/\/[^'"]+['"][^>]*>/gi, '')
    .replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs: string, cssText: string) => {
      return `<style${attrs}>${sanitizeMeasurementCss(cssText)}</style>`;
    })
    .replace(/\sstyle=(['"])([\s\S]*?)\1/gi, (_match, quote: string, cssText: string) => {
      return ` style=${quote}${sanitizeMeasurementCss(cssText)}${quote}`;
    });

const buildMeasurementDocumentHtml = (rawHtml: string) => {
  const sanitizedHtml = sanitizeMeasurementHtml(rawHtml);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      body {
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    </style>
  </head>
  <body>${sanitizedHtml}</body>
</html>`;
};

const buildTextMeasurementDocumentHtml = (
  runs: TemplateExtractMeasuredTextRunInput[],
  embeddedFonts: TemplateExtractPdfEmbeddedFont[] = []
) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      body {
        background: #ffffff;
      }
      ${buildEmbeddedFontFaceCss(embeddedFonts)}
      #measurement-root {
        position: absolute;
        left: -10000px;
        top: 0;
        white-space: nowrap;
      }
      .measurement-run {
        display: inline-block;
        white-space: pre;
        line-height: 1;
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <div id="measurement-root">
${runs
  .map(
    (run) => `      <span class="measurement-run" data-run-id="${escapeHtml(run.id)}" style="font-family:${escapeHtml(
      run.fontFamily
    )};font-size:${Number(run.fontSize.toFixed(2))}px;font-weight:${escapeHtml(
      String(run.fontWeight || 400)
    )};">${escapeHtml(run.text)}</span>`
  )
  .join('\n')}
    </div>
  </body>
</html>`;

class ChromeCdpClient {
  private nextId = 1;
  private pendingRequests = new Map<number, PendingRequest>();

  constructor(private readonly socket: WebSocket) {
    socket.on('message', (rawMessage) => {
      const messages = String(rawMessage || '')
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean);

      for (const messageText of messages) {
        try {
          const message = JSON.parse(messageText) as ChromeJsonRpcMessage;

          if (typeof message.id !== 'number') {
            continue;
          }

          const pending = this.pendingRequests.get(message.id);

          if (!pending) {
            continue;
          }

          this.pendingRequests.delete(message.id);

          if (message.error) {
            pending.reject(
              new Error(
                `CDP ${message.error.code ?? 'error'}: ${message.error.message || 'unknown error'}`
              )
            );
            continue;
          }

          pending.resolve(message.result);
        } catch {
          // Ignore malformed CDP messages.
        }
      }
    });

    socket.on('close', () => {
      for (const pending of this.pendingRequests.values()) {
        pending.reject(new Error('Chrome DevTools 연결이 종료되었습니다.'));
      }
      this.pendingRequests.clear();
    });
  }

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string) {
    const id = this.nextId;
    this.nextId += 1;

    const payload: ChromeJsonRpcMessage = { id, method, params };

    if (sessionId) {
      payload.sessionId = sessionId;
    }

    return new Promise<unknown>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(payload), (error) => {
        if (!error) {
          return;
        }

        this.pendingRequests.delete(id);
        reject(error);
      });
    });
  }
}

const extractRemoteDebuggingWebSocketUrl = (buffer: string) => {
  const matched = buffer.match(REMOTE_DEBUGGING_WS_PATTERN);
  return matched?.[1] || '';
};

const launchChrome = async (profileDir: string) => {
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-popup-blocking',
    '--disable-extensions',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ];

  const chromeProcess = spawn(CHROME_BINARY_PATH, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const debugWebSocketUrl = await new Promise<string>((resolve, reject) => {
    let settled = false;
    let stderrBuffer = '';
    let stdoutBuffer = '';
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      reject(
        new Error(
          `Headless Chrome 디버그 소켓을 열지 못했습니다. stderr=${stderrBuffer.trim() || '-'} stdout=${stdoutBuffer.trim() || '-'}`
        )
      );
    }, 15000);

    const finalize = (value: string) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };

    const rejectWith = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    };

    chromeProcess.stderr?.on('data', (chunk) => {
      stderrBuffer += String(chunk || '');
      const url = extractRemoteDebuggingWebSocketUrl(stderrBuffer);

      if (url) {
        finalize(url);
      }
    });

    chromeProcess.stdout?.on('data', (chunk) => {
      stdoutBuffer += String(chunk || '');
      const url = extractRemoteDebuggingWebSocketUrl(stdoutBuffer);

      if (url) {
        finalize(url);
      }
    });

    chromeProcess.once('exit', (code, signal) => {
      rejectWith(
        new Error(
          `Headless Chrome 이 조기 종료되었습니다. code=${String(code)} signal=${String(signal)} stderr=${stderrBuffer.trim() || '-'}`
        )
      );
    });
  });

  return {
    chromeProcess,
    debugWebSocketUrl,
  };
};

const connectToChrome = (debugWebSocketUrl: string) =>
  new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(debugWebSocketUrl);

    socket.once('open', () => resolve(socket));
    socket.once('error', (error) => reject(error));
  });

const waitForDocumentStable = async (client: ChromeCdpClient, sessionId: string) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const readyStateResult = (await client.send(
      'Runtime.evaluate',
      {
        expression: 'document.readyState',
        returnByValue: true,
      },
      sessionId
    )) as {
      result?: {
        value?: string;
      };
    };

    if (readyStateResult.result?.value === 'complete') {
      break;
    }

    await wait(100);
  }

  await client.send(
    'Runtime.evaluate',
    {
      expression:
        'document.fonts ? document.fonts.ready.then(() => true) : Promise.resolve(true)',
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId
  );

  await client.send(
    'Runtime.evaluate',
    {
      expression:
        'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))',
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId
  );
};

const readDocumentMetrics = async (client: ChromeCdpClient, sessionId: string) => {
  const evaluation = (await client.send(
    'Runtime.evaluate',
    {
      expression: `(() => {
        const elements = Array.from(document.querySelectorAll('[data-page-number], [data-page]'));
        const pages = (elements.length > 0 ? elements : [document.body]).map((element, index) => {
          const rect = element.getBoundingClientRect();
          const rawPageNumber =
            element.getAttribute('data-page-number') ||
            element.getAttribute('data-page') ||
            String(index + 1);
          const parsedPageNumber = Number(rawPageNumber);

          return {
            pageNumber: Number.isFinite(parsedPageNumber) && parsedPageNumber > 0 ? parsedPageNumber : index + 1,
            x: Math.max(0, rect.left + window.scrollX),
            y: Math.max(0, rect.top + window.scrollY),
            width: Math.max(1, rect.width),
            height: Math.max(1, rect.height),
          };
        });

        return {
          contentWidth: Math.max(
            document.documentElement.scrollWidth || 0,
            document.documentElement.clientWidth || 0,
            document.body ? document.body.scrollWidth || 0 : 0,
            ...pages.map((page) => page.x + page.width)
          ),
          contentHeight: Math.max(
            document.documentElement.scrollHeight || 0,
            document.documentElement.clientHeight || 0,
            document.body ? document.body.scrollHeight || 0 : 0,
            ...pages.map((page) => page.y + page.height)
          ),
          pages,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId
  )) as {
    result?: {
      value?: RenderDocumentMetrics;
    };
    exceptionDetails?: {
      text?: string;
    };
  };

  if (evaluation.exceptionDetails) {
    throw new Error(
      `측정 HTML 페이지 정보를 읽지 못했습니다. ${evaluation.exceptionDetails.text || 'unknown_error'}`
    );
  }

  return evaluation.result?.value || { contentWidth: 0, contentHeight: 0, pages: [] };
};

export const TemplateExtractHtmlRenderService = {
  async renderPageImages(html: string): Promise<string[]> {
    const normalizedHtml = String(html || '').trim();

    if (!normalizedHtml) {
      throw new Error('시각 유사도 측정 실패: 렌더할 output HTML 이 비어 있습니다.');
    }

    const tempDir = await mkdtemp(join(tmpdir(), 'template-extract-html-render-'));
    const profileDir = join(tempDir, 'chrome-profile');
    const documentFilePath = join(tempDir, 'measurement.html');
    let chromeProcess: ReturnType<typeof spawn> | null = null;
    let browserSocket: WebSocket | null = null;

    try {
      await writeFile(documentFilePath, buildMeasurementDocumentHtml(normalizedHtml), 'utf8');

      const launched = await launchChrome(profileDir);
      chromeProcess = launched.chromeProcess;
      browserSocket = await connectToChrome(launched.debugWebSocketUrl);
      const client = new ChromeCdpClient(browserSocket);
      const targetId = ((await client.send('Target.createTarget', {
        url: 'about:blank',
      })) as { targetId?: string }).targetId;

      if (!targetId) {
        throw new Error('Headless Chrome target 을 만들지 못했습니다.');
      }

      const sessionId = ((await client.send('Target.attachToTarget', {
        targetId,
        flatten: true,
      })) as { sessionId?: string }).sessionId;

      if (!sessionId) {
        throw new Error('Headless Chrome target session 을 만들지 못했습니다.');
      }

      await client.send('Page.enable', {}, sessionId);
      await client.send('Runtime.enable', {}, sessionId);
      await client.send(
        'Emulation.setDefaultBackgroundColorOverride',
        {
          color: {
            r: 255,
            g: 255,
            b: 255,
            a: 1,
          },
        },
        sessionId
      );
      await client.send(
        'Emulation.setDeviceMetricsOverride',
        {
          width: DEFAULT_VIEWPORT_WIDTH,
          height: DEFAULT_VIEWPORT_HEIGHT,
          deviceScaleFactor: DEFAULT_DEVICE_SCALE_FACTOR,
          mobile: false,
        },
        sessionId
      );
      await client.send(
        'Page.navigate',
        {
          url: pathToFileURL(documentFilePath).toString(),
        },
        sessionId
      );
      await waitForDocumentStable(client, sessionId);

      const initialMetrics = await readDocumentMetrics(client, sessionId);
      const viewportWidth = Math.max(DEFAULT_VIEWPORT_WIDTH, Math.ceil(initialMetrics.contentWidth) + 32);
      const viewportHeight = Math.max(
        DEFAULT_VIEWPORT_HEIGHT,
        Math.min(4096, Math.ceil(initialMetrics.pages[0]?.height || initialMetrics.contentHeight || DEFAULT_VIEWPORT_HEIGHT) + 64)
      );

      await client.send(
        'Emulation.setDeviceMetricsOverride',
        {
          width: viewportWidth,
          height: viewportHeight,
          deviceScaleFactor: DEFAULT_DEVICE_SCALE_FACTOR,
          mobile: false,
        },
        sessionId
      );
      await waitForDocumentStable(client, sessionId);

      const metrics = await readDocumentMetrics(client, sessionId);
      const pageImages: Array<{ pageNumber: number; dataUrl: string }> = [];

      for (const page of metrics.pages) {
        const screenshotResult = (await client.send(
          'Page.captureScreenshot',
          {
            format: 'png',
            fromSurface: true,
            captureBeyondViewport: true,
            clip: {
              x: Math.max(0, page.x),
              y: Math.max(0, page.y),
              width: Math.max(1, page.width),
              height: Math.max(1, page.height),
              scale: 1,
            },
          },
          sessionId
        )) as { data?: string };

        if (!screenshotResult.data) {
          throw new Error(`HTML 페이지 ${page.pageNumber} 스크린샷을 생성하지 못했습니다.`);
        }

        pageImages.push({
          pageNumber: page.pageNumber,
          dataUrl: `data:image/png;base64,${screenshotResult.data}`,
        });
      }

      await client.send('Target.closeTarget', { targetId });

      return pageImages
        .sort((left, right) => left.pageNumber - right.pageNumber)
        .map((page) => page.dataUrl);
    } finally {
      try {
        browserSocket?.close();
      } catch {
        // ignore close failures
      }

      if (chromeProcess && !chromeProcess.killed) {
        chromeProcess.kill('SIGKILL');
      }

      await rm(tempDir, { recursive: true, force: true });
    }
  },

  async measureTextRuns(
    runs: TemplateExtractMeasuredTextRunInput[],
    embeddedFonts: TemplateExtractPdfEmbeddedFont[] = []
  ): Promise<Record<string, number>> {
    if (!runs.length) {
      return {};
    }

    const tempDir = await mkdtemp(join(tmpdir(), 'template-extract-text-measure-'));
    const profileDir = join(tempDir, 'chrome-profile');
    const documentFilePath = join(tempDir, 'measurement-text.html');
    let chromeProcess: ReturnType<typeof spawn> | null = null;
    let browserSocket: WebSocket | null = null;

    try {
      await writeFile(documentFilePath, buildTextMeasurementDocumentHtml(runs, embeddedFonts), 'utf8');

      const launched = await launchChrome(profileDir);
      chromeProcess = launched.chromeProcess;
      browserSocket = await connectToChrome(launched.debugWebSocketUrl);
      const client = new ChromeCdpClient(browserSocket);
      const targetId = ((await client.send('Target.createTarget', {
        url: 'about:blank',
      })) as { targetId?: string }).targetId;

      if (!targetId) {
        throw new Error('Headless Chrome target 을 만들지 못했습니다.');
      }

      const sessionId = ((await client.send('Target.attachToTarget', {
        targetId,
        flatten: true,
      })) as { sessionId?: string }).sessionId;

      if (!sessionId) {
        throw new Error('Headless Chrome target session 을 만들지 못했습니다.');
      }

      await client.send('Page.enable', {}, sessionId);
      await client.send('Runtime.enable', {}, sessionId);
      await client.send(
        'Emulation.setDeviceMetricsOverride',
        {
          width: DEFAULT_VIEWPORT_WIDTH,
          height: DEFAULT_VIEWPORT_HEIGHT,
          deviceScaleFactor: DEFAULT_DEVICE_SCALE_FACTOR,
          mobile: false,
        },
        sessionId
      );
      await client.send(
        'Page.navigate',
        {
          url: pathToFileURL(documentFilePath).toString(),
        },
        sessionId
      );
      await waitForDocumentStable(client, sessionId);

      const evaluation = (await client.send(
        'Runtime.evaluate',
        {
          expression: `(() => {
            return Array.from(document.querySelectorAll('[data-run-id]')).map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                id: element.getAttribute('data-run-id') || '',
                width: rect.width || 0,
              };
            });
          })()`,
          awaitPromise: true,
          returnByValue: true,
        },
        sessionId
      )) as {
        result?: {
          value?: TemplateExtractMeasuredTextRunOutput[];
        };
      };

      await client.send('Target.closeTarget', { targetId });

      return Object.fromEntries(
        (evaluation.result?.value || []).map((item) => [item.id, item.width] satisfies [string, number])
      );
    } finally {
      try {
        browserSocket?.close();
      } catch {
        // ignore close failures
      }

      if (chromeProcess && !chromeProcess.killed) {
        chromeProcess.kill('SIGKILL');
      }

      await rm(tempDir, { recursive: true, force: true });
    }
  },
};
