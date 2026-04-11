"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, Ref } from "react";
import { createRoot } from "react-dom/client";
import { List, Loader2, LogIn, MessageCircle, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  ConversationModelChatColumnLego,
  ConversationModelSetupColumnLego,
  ConversationThread,
  type ConversationModelChatColumnLegoProps,
  type ConversationModelSetupColumnLegoProps,
} from "@/components/design-system/conversation/ConversationUI.parts";
import { renderBotContent } from "@/lib/conversation/messageRenderUtils";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/conversation/client/laboratoryPageState";
import { encodeWidgetOverrides } from "@/lib/widgetOverrides";

const globalScope = typeof globalThis !== "undefined" ? (globalThis as Record<string, any>) : undefined;
if (globalScope && typeof globalScope.process === "undefined") {
  globalScope.process = { env: { NODE_ENV: "production" } };
}

// ------------------------------------------------------------
// Unified widget UI assembly file.
// Edit this file to affect widget UI service-wide.
// ------------------------------------------------------------
export type WidgetLauncherPosition = "bottom-right" | "bottom-left";
export type WidgetConversationTab = "chat" | "list" | "policy" | "login";
export type WidgetLauncherEntryMode = "launcher" | "embed";
export type WidgetLauncherPlacement = {
  position?: WidgetLauncherPosition;
  bottom?: string;
  left?: string;
  right?: string;
  zIndex?: number;
  bottomOffset?: string;
  sideOffset?: string;
};

type WidgetLauncherPlacementInput = {
  cfg?: unknown;
  launcher?: unknown;
  iframe?: unknown;
  position?: unknown;
  bottom?: unknown;
  left?: unknown;
  right?: unknown;
  zIndex?: unknown;
  bottomOffset?: unknown;
  sideOffset?: unknown;
};

function isRecordLike(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCssOffsetValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function normalizeZIndexValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return undefined;
}

function normalizeLauncherPositionValue(value: unknown): WidgetLauncherPosition | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes("left")) return "bottom-left";
  if (normalized.includes("right")) return "bottom-right";
  return undefined;
}

export function resolveWidgetLauncherPlacement(input?: WidgetLauncherPlacementInput | null): WidgetLauncherPlacement {
  const cfg = isRecordLike(input?.cfg) ? input.cfg : null;
  const launcher = isRecordLike(input?.launcher) ? input.launcher : null;
  const launcherContainer = isRecordLike(launcher?.container) ? launcher.container : null;
  const iframe = isRecordLike(input?.iframe) ? input.iframe : null;

  const left = normalizeCssOffsetValue(input?.left ?? launcherContainer?.left);
  const right = normalizeCssOffsetValue(input?.right ?? launcherContainer?.right);
  const position =
    normalizeLauncherPositionValue(input?.position ?? cfg?.position) ||
    (left && !right ? "bottom-left" : right && !left ? "bottom-right" : undefined);

  return {
    position,
    bottom: normalizeCssOffsetValue(input?.bottom ?? launcherContainer?.bottom),
    left,
    right,
    zIndex: normalizeZIndexValue(input?.zIndex ?? launcherContainer?.zIndex),
    bottomOffset: normalizeCssOffsetValue(input?.bottomOffset ?? iframe?.bottomOffset),
    sideOffset: normalizeCssOffsetValue(input?.sideOffset ?? iframe?.sideOffset),
  };
}

export type WidgetLauncherContainerProps = {
  children?: ReactNode;
  position?: WidgetLauncherPosition;
  layout?: "fixed" | "absolute";
  containerId?: string;
  mountTo?: HTMLElement | null;
  bottom?: string;
  left?: string;
  right?: string;
  zIndex?: number;
  stack?: boolean;
  gap?: string;
  className?: string;
  style?: CSSProperties;
  applyMountStyles?: boolean;
  applyMountClassName?: boolean;
};

export type WidgetShellProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function WidgetShell({ children, className, style }: WidgetShellProps) {
  return (
    <div
      className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}
      style={style}
      parts-lego="WidgetShell"
    >
      {children}
    </div>
  );
}

export function WidgetLauncherContainer({
  children,
  position = "bottom-right",
  layout = "fixed",
  containerId = "mejai-widget-container",
  mountTo,
  bottom = "24px",
  left = "24px",
  right = "24px",
  zIndex = 2147483647,
  stack = false,
  gap = "12px",
  className,
  style,
  applyMountStyles = true,
  applyMountClassName = true,
}: WidgetLauncherContainerProps) {
  const resolvedStyle = useMemo<CSSProperties>(() => {
    return {
      position: layout,
      zIndex,
      bottom,
      ...(position === "bottom-left" ? { left } : { right }),
      ...(stack
        ? {
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap,
        }
        : {}),
      ...style,
    };
  }, [layout, zIndex, bottom, position, left, right, stack, gap, style]);

  useEffect(() => {
    if (!mountTo) return;
    if (containerId) {
      mountTo.id = containerId;
    }
    mountTo.setAttribute("panel-lego", "WidgetLauncherContainer");
    if (className && applyMountClassName) {
      mountTo.className = className;
    }
    if (applyMountStyles) {
      const managedStyleKeys = ["position", "zIndex", "bottom", "left", "right", "top", "display", "flexDirection", "alignItems", "gap"];
      managedStyleKeys.forEach((key) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mountTo.style as any)[key] = "";
      });
      Object.entries(resolvedStyle).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mountTo.style as any)[key] = value;
      });
    }
  }, [mountTo, containerId, className, resolvedStyle, applyMountStyles, applyMountClassName]);

  if (mountTo) {
    return <>{children}</>;
  }

  return (
    <div id={containerId} className={className} style={resolvedStyle} panel-lego="WidgetLauncherContainer">
      {children}
    </div>
  );
}

export type WidgetLauncherIconProps = {
  src: string;
  alt: string;
  size?: number;
  hidden?: boolean;
  onError?: () => void;
  className?: string;
  style?: CSSProperties;
};

export function WidgetLauncherIcon({
  src,
  alt,
  size = 56,
  hidden = false,
  onError,
  className,
  style,
}: WidgetLauncherIconProps) {
  const sizePx = `${size}px`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      parts-lego="WidgetLauncherIcon"
      onError={onError}
      className={className}
      style={{
        width: sizePx,
        height: sizePx,
        objectFit: "cover",
        borderRadius: "16px",
        display: hidden ? "none" : "block",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

export type WidgetLauncherLabelProps = {
  label: string;
  size?: number;
  hidden?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function WidgetLauncherLabel({
  label,
  size = 20,
  hidden = false,
  className,
  style,
}: WidgetLauncherLabelProps) {
  return (
    <span
      className={className}
      parts-lego="WidgetLauncherLabel"
      style={{
        display: hidden ? "none" : "block",
        fontSize: `${size}px`,
        pointerEvents: "none",
        ...style,
      }}
    >
      {label}
    </span>
  );
}

export type WidgetLauncherButtonProps = {
  brandName: string;
  iconUrl?: string | null;
  label?: string;
  primaryColor?: string;
  size?: number;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
};

export function WidgetLauncherButton({
  brandName,
  iconUrl,
  label = "💬",
  primaryColor = "#0f172a",
  size = 56,
  onClick,
  className,
  style,
}: WidgetLauncherButtonProps) {
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setIconFailed(false);
  }, [iconUrl]);

  const resolvedIconUrl = iconUrl || "/brand/logo.png";
  const showIcon = Boolean(resolvedIconUrl) && !iconFailed;
  const sizePx = `${size}px`;
  const labelSize = Math.max(12, Math.round(size * 0.36));
  const fontSize = Math.max(12, Math.round(size * 0.4));

  return (
    <button
      type="button"
      aria-label={`${brandName} Chatbot`}
      onClick={onClick}
      parts-lego="WidgetLauncherButton"
      className={className}
      style={{
        width: sizePx,
        height: sizePx,
        borderRadius: "16px",
        border: "none",
        cursor: "pointer",
        boxShadow: "none",
        background: "transparent",
        color: "#fff",
        fontSize: `${fontSize}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        ...style,
      }}
    >
      <WidgetLauncherIcon
        src={resolvedIconUrl}
        alt={`${brandName} Icon`}
        size={size}
        hidden={!showIcon}
        onError={() => setIconFailed(true)}
      />
      <WidgetLauncherLabel label={label} size={labelSize} hidden={showIcon} />
    </button>
  );
}

export type WidgetLauncherIframeProps = {
  position?: WidgetLauncherPosition;
  layout?: "fixed" | "absolute";
  bottomOffset?: string;
  sideOffset?: string;
  width?: string;
  height?: string;
  isOpen?: boolean;
  title?: string;
  src?: string;
  allow?: string;
  onLoad?: () => void;
  iframeRef?: Ref<HTMLIFrameElement>;
  className?: string;
  style?: CSSProperties;
  borderRadius?: string;
  boxShadow?: string;
  background?: string;
  asPlaceholder?: boolean;
  placeholderLabel?: string;
};

export function WidgetLauncherIframe({
  position = "bottom-right",
  layout = "absolute",
  bottomOffset = "72px",
  sideOffset = "0",
  width = "360px",
  height = "560px",
  isOpen = false,
  title = "Mejai Widget",
  src,
  allow = "clipboard-write",
  onLoad,
  iframeRef,
  className,
  style,
  borderRadius = "16px",
  boxShadow = "0 20px 40px rgba(15, 23, 42, 0.2)",
  background = "#fff",
  asPlaceholder = false,
  placeholderLabel = "iframe (display:none 상태로 로드됨)",
}: WidgetLauncherIframeProps) {
  if (asPlaceholder) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-500",
          className
        )}
        panel-lego="WidgetLauncherIframe.Placeholder"
        style={style}
      >
        {placeholderLabel}
      </div>
    );
  }

  return (
    <iframe
      title={title}
      allow={allow}
      src={src}
      onLoad={onLoad}
      ref={iframeRef}
      className={className}
      panel-lego="WidgetLauncherIframe"
      style={{
        position: layout,
        bottom: bottomOffset,
        ...(position === "bottom-left" ? { left: sideOffset } : { right: sideOffset }),
        width,
        height,
        border: "none",
        borderRadius,
        boxShadow,
        background,
        display: isOpen ? "block" : "none",
        ...style,
      }}
    />
  );
}

type WidgetLauncherWindow = Window & {
  __mejaiWidgetLoaded?: boolean;
  __mejaiWidgetMount?: (input?: unknown) => void;
  mejaiWidget?: Record<string, any> | Array<Record<string, any>>;
};

export type WidgetLauncherRuntimeConfig = {
  cfg: Record<string, any>;
  baseUrl: string;
  widgetId?: string;
  widgetPublicKey?: string;
  instanceId?: string;
  instancePublicKey?: string;
  templateId?: string;
  visitorId: string;
  sessionId: string;
  sessionStorageKey: string;
  position?: WidgetLauncherPosition;
  brandName: string;
  launcherLabel: string;
  mountNode: HTMLElement;
  entryMode?: WidgetLauncherEntryMode;
  tab?: WidgetConversationTab;
  previewMode?: boolean;
  previewMeta?: {
    origin?: string;
    page_url?: string;
    referrer?: string;
  };
  defaultOpen?: boolean;
  layout?: "fixed" | "absolute";
  bottom?: string;
  left?: string;
  right?: string;
  zIndex?: number;
  bottomOffset?: string;
  sideOffset?: string;
  initNonce?: number;
  disableToggle?: boolean;
  onLauncherClick?: () => void;
};

function readThemeValue(theme: Record<string, any> | null, keys: string[]) {
  if (!theme || typeof theme !== "object") return "";
  for (const key of keys) {
    const value = theme[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeIconUrl(value: string, baseUrl: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("data:") || raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("blob:")) {
    return raw;
  }
  if (raw.startsWith("/")) {
    return `${baseUrl}${raw}`;
  }
  return raw;
}

function resolveLauncherIcon(cfg: Record<string, any>, themeConfig: Record<string, any>, baseUrl: string) {
  const raw =
    readThemeValue(cfg, ["launcherIconUrl", "launcherIcon", "launcher_icon_url", "launcher_logo_id", "icon", "icon_url"]) ||
    readThemeValue(themeConfig, ["launcher_icon_url", "launcher_logo_id", "launcherIconUrl", "icon_url", "iconUrl", "icon"]);
  return normalizeIconUrl(raw, baseUrl) || `${baseUrl}/brand/logo.png`;
}

function resolveLauncherColor(cfg: Record<string, any>, themeConfig: Record<string, any>) {
  return (
    readThemeValue(cfg, ["primaryColor", "primary_color", "launcher_bg", "launcherBg"]) ||
    readThemeValue(themeConfig, ["launcher_bg", "launcherBg", "primary_color", "primaryColor"])
  );
}

export type WidgetEmbedTarget = {
  widgetId?: string;
  widgetPublicKey?: string;
  instanceId?: string;
  instancePublicKey?: string;
  templateId?: string;
};

export function buildWidgetEmbedSrc(
  baseUrl: string,
  target: WidgetEmbedTarget,
  visitorId: string,
  sessionId: string,
  overridesParam?: string,
  previewMeta?: {
    origin?: string;
    page_url?: string;
    referrer?: string;
  },
  tab?: WidgetConversationTab,
  options?: { preview?: boolean }
) {
  const widgetId = String(target.widgetId || "").trim();
  const widgetPublicKey = String(target.widgetPublicKey || "").trim();
  const instanceId = String(target.instanceId || "").trim();
  const instancePublicKey = String(target.instancePublicKey || "").trim();
  const templateId = String(target.templateId || "").trim();

  let src = "";
  if (instanceId && instancePublicKey && templateId) {
    src = `${baseUrl}/embed/instance_id=${encodeURIComponent(instanceId)}?public_key=${encodeURIComponent(
      instancePublicKey
    )}&template_id=${encodeURIComponent(templateId)}`;
  } else if (widgetId && widgetPublicKey) {
    src = `${baseUrl}/embed/widget_id=${encodeURIComponent(widgetId)}?public_key=${encodeURIComponent(
      widgetPublicKey
    )}`;
  } else {
    return "";
  }
  src += `&vid=${encodeURIComponent(visitorId)}`;
  if (sessionId) {
    src += `&sid=${encodeURIComponent(sessionId)}`;
  }
  if (overridesParam) {
    src += `&ovr=${encodeURIComponent(overridesParam)}`;
  }
  if (previewMeta) {
    const origin = String(previewMeta.origin || "").trim();
    const pageUrl = String(previewMeta.page_url || "").trim();
    const referrer = String(previewMeta.referrer || "").trim();
    if (origin) src += `&origin=${encodeURIComponent(origin)}`;
    if (pageUrl) src += `&page_url=${encodeURIComponent(pageUrl)}`;
    if (referrer) src += `&referrer=${encodeURIComponent(referrer)}`;
  }
  if (tab) {
    src += `&tab=${encodeURIComponent(tab)}`;
  }
  if (options?.preview) {
    src += `&preview=1`;
  }
  return src;
}

export function WidgetLauncherRuntime({
  cfg,
  baseUrl,
  widgetId,
  widgetPublicKey,
  instanceId,
  instancePublicKey,
  templateId,
  visitorId,
  sessionId,
  sessionStorageKey,
  position,
  brandName,
  launcherLabel,
  mountNode,
  entryMode,
  tab,
  previewMode,
  previewMeta,
  defaultOpen = false,
  layout,
  bottom,
  left,
  right,
  zIndex,
  bottomOffset,
  sideOffset,
  initNonce,
  disableToggle = false,
  onLauncherClick,
}: WidgetLauncherRuntimeConfig) {
  const cfgRef = useRef(cfg);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sessionIdRef = useRef(sessionId);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isEmbedMode = entryMode === "embed";
  const [isMobile, setIsMobile] = useState(false);
  const [themeConfig, setThemeConfig] = useState<Record<string, any>>({});
  const [resolvedName, setResolvedName] = useState(brandName);
  const [remotePlacement, setRemotePlacement] = useState<WidgetLauncherPlacement>({});
  const viewportRafRef = useRef<number | null>(null);

  useEffect(() => {
    cfgRef.current = cfg;
  }, [cfg]);

  const resolvedIconUrl = useMemo(
    () => resolveLauncherIcon(cfg, themeConfig, baseUrl),
    [cfg, themeConfig, baseUrl]
  );
  const resolvedColor = useMemo(() => {
    return resolveLauncherColor(cfg, themeConfig) || "#0f172a";
  }, [cfg, themeConfig]);
  const resolvedLabel = useMemo(() => {
    const cfgLabel = cfg.launcherLabel;
    if (typeof cfgLabel === "string" && cfgLabel.trim()) return cfgLabel.trim();
    return launcherLabel || "💬";
  }, [cfg, launcherLabel]);

  const overridesParam = useMemo(() => {
    if (!cfg?.overrides || typeof cfg.overrides !== "object") return "";
    return encodeWidgetOverrides(cfg.overrides as Record<string, unknown>);
  }, [cfg]);

  const explicitPlacement = useMemo(
    () =>
      resolveWidgetLauncherPlacement({
        position,
        bottom,
        left,
        right,
        zIndex,
        bottomOffset,
        sideOffset,
      }),
    [position, bottom, left, right, zIndex, bottomOffset, sideOffset]
  );

  const resolvedPlacement = useMemo(() => {
    const merged: WidgetLauncherPlacement = {
      position: explicitPlacement.position ?? remotePlacement.position,
      bottom: explicitPlacement.bottom ?? remotePlacement.bottom,
      left: explicitPlacement.left ?? remotePlacement.left,
      right: explicitPlacement.right ?? remotePlacement.right,
      zIndex: explicitPlacement.zIndex ?? remotePlacement.zIndex,
      bottomOffset: explicitPlacement.bottomOffset ?? remotePlacement.bottomOffset,
      sideOffset: explicitPlacement.sideOffset ?? remotePlacement.sideOffset,
    };
    if (!merged.position) {
      merged.position = merged.left && !merged.right ? "bottom-left" : "bottom-right";
    }
    return merged;
  }, [explicitPlacement, remotePlacement]);

  const embedTarget = useMemo<WidgetEmbedTarget>(() => {
    if (instanceId && instancePublicKey && templateId) {
      return { instanceId, instancePublicKey, templateId };
    }
    if (widgetId && widgetPublicKey) {
      return { widgetId, widgetPublicKey };
    }
    return {};
  }, [instanceId, instancePublicKey, templateId, widgetId, widgetPublicKey]);

  const iframeSrc = useMemo(
    () =>
      buildWidgetEmbedSrc(baseUrl, embedTarget, visitorId, sessionIdRef.current, overridesParam, previewMeta, tab, {
        preview: previewMode,
      }),
    [
      baseUrl,
      embedTarget,
      visitorId,
      overridesParam,
      previewMeta?.origin,
      previewMeta?.page_url,
      previewMeta?.referrer,
      tab,
      previewMode,
    ]
  );

  const notify = (eventType: "open" | "close") => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "mejai_widget_event", event: eventType },
        "*"
      );
    } catch {
      // ignore
    }
  };

  const storeSession = (nextSessionId: string) => {
    if (!nextSessionId) return;
    const trimmed = String(nextSessionId || "").trim();
    if (!trimmed) return;
    sessionIdRef.current = trimmed;
    try {
      localStorage.setItem(sessionStorageKey, trimmed);
    } catch {
      // ignore
    }
  };

  const handleToggle = () => {
    onLauncherClick?.();
    if (disableToggle || isEmbedMode) return;
    setIsOpen((prev) => {
      const next = !prev;
      notify(next ? "open" : "close");
      return next;
    });
  };

  const resolvePreviewOrigin = () => {
    const rawOrigin = String(previewMeta?.origin || "").trim();
    if (rawOrigin) return rawOrigin;
    const rawPageUrl = String(previewMeta?.page_url || "").trim();
    if (rawPageUrl) {
      try {
        return new URL(rawPageUrl).origin;
      } catch {
        return "";
      }
    }
    return window.location.origin;
  };

  const resolvePreviewPageUrl = () => {
    const rawPageUrl = String(previewMeta?.page_url || "").trim();
    return rawPageUrl || window.location.href;
  };

  const resolvePreviewReferrer = () => {
    const rawReferrer = String(previewMeta?.referrer || "").trim();
    return rawReferrer || document.referrer || "";
  };

  const sendInitMessage = () => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "mejai_widget_init",
          user: cfgRef.current.user || null,
          origin: resolvePreviewOrigin(),
          page_url: resolvePreviewPageUrl(),
          referrer: resolvePreviewReferrer(),
          visitor_id: visitorId,
          session_id: sessionIdRef.current || "",
          overrides: cfgRef.current.overrides || null,
        },
        "*"
      );
    } catch {
      // ignore
    }
  };

  const handleIframeLoad = () => {
    sendInitMessage();
    notify("open");
  };

  useEffect(() => {
    if (!iframeRef.current) return;
    sendInitMessage();
  }, [initNonce, previewMeta?.origin, previewMeta?.page_url, previewMeta?.referrer]);

  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;
    const media = window.matchMedia("(max-width: 640px)");
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!isEmbedMode) return;
    if (typeof window === "undefined" || !mountNode) return;
    const computed = window.getComputedStyle(mountNode);
    if (!computed || computed.position === "static") {
      mountNode.style.position = "relative";
    }
  }, [isEmbedMode, mountNode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const vv = window.visualViewport;
    const applyViewportVars = () => {
      const height = vv?.height || window.innerHeight;
      const width = vv?.width || window.innerWidth;
      const offsetTop = vv?.offsetTop || 0;
      const apply = (el: HTMLElement | null) => {
        if (!el) return;
        el.style.setProperty("--mejai-vh", `${height}px`);
        el.style.setProperty("--mejai-vw", `${width}px`);
        el.style.setProperty("--mejai-vv-offset-top", `${offsetTop}px`);
      };
      apply(root);
      apply(mountNode);
    };
    const schedule = () => {
      if (viewportRafRef.current !== null) cancelAnimationFrame(viewportRafRef.current);
      viewportRafRef.current = requestAnimationFrame(() => {
        viewportRafRef.current = null;
        applyViewportVars();
      });
    };
    applyViewportVars();
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    return () => {
      if (viewportRafRef.current !== null) cancelAnimationFrame(viewportRafRef.current);
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, [mountNode]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== baseUrl) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data || {};
      if (data.type === "mejai_widget_session" && data.session_id) {
        storeSession(data.session_id);
      }
      if (data.type === "mejai_widget_theme" && data.theme) {
        setThemeConfig(data.theme || {});
        if (typeof data.name === "string" && data.name.trim()) {
          setResolvedName(data.name.trim());
        }
      }
      if (data.type === "mejai_widget_request_close") {
        setIsOpen(false);
        notify("close");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [baseUrl]);

  useEffect(() => {
    try {
      setRemotePlacement({});
      const params = new URLSearchParams();
      if (instanceId && instancePublicKey && templateId) {
        params.set("instance_id", instanceId);
        params.set("public_key", instancePublicKey);
        params.set("template_id", templateId);
      } else if (widgetId && widgetPublicKey) {
        params.set("widget_id", widgetId);
        params.set("public_key", widgetPublicKey);
      } else {
        return;
      }
      if (overridesParam) {
        params.set("ovr", overridesParam);
      }
      const url = `${baseUrl}/api/widget/config?${params.toString()}`;
      fetch(url)
        .then((res) => {
          if (!res || !res.ok) return null;
          return res.json();
        })
        .then((data) => {
          if (!data || !data.widget) return;
          setThemeConfig(data.widget.theme || {});
          if (typeof data.widget.name === "string" && data.widget.name.trim()) {
            setResolvedName(data.widget.name.trim());
          }
          const remoteWidget = isRecordLike(data.widget.chat_policy?.widget) ? data.widget.chat_policy.widget : null;
          setRemotePlacement(resolveWidgetLauncherPlacement(remoteWidget));
        })
        .catch(() => {
          // ignore
        });
    } catch {
      // ignore
    }
  }, [baseUrl, instanceId, instancePublicKey, templateId, widgetId, widgetPublicKey, overridesParam]);

  const launcherBottom = isMobile ? "calc(16px + env(safe-area-inset-bottom))" : "24px";
  const launcherRight = isMobile ? "calc(16px + env(safe-area-inset-right))" : "24px";
  const launcherLeft = isMobile ? "calc(16px + env(safe-area-inset-left))" : "24px";
  const showLauncher = !isEmbedMode;
  const resolvedOpen = isEmbedMode ? true : isOpen;
  const iframeLayout = isEmbedMode ? "absolute" : isMobile ? "fixed" : "absolute";
  const iframeWidth = isEmbedMode ? "100%" : undefined;
  const iframeHeight = isEmbedMode ? "100%" : undefined;
  const iframeBorderRadius = isEmbedMode ? "inherit" : undefined;
  const iframeBoxShadow = isEmbedMode ? "none" : undefined;
  const iframeBackground = isEmbedMode ? "transparent" : undefined;
  const iframeStyle = isEmbedMode
    ? { top: "0", left: "0", right: "0", bottom: "0" }
    : isMobile
      ? {
        top: "var(--mejai-vv-offset-top, 0px)",
        left: "0",
        right: "0",
      }
      : undefined;

  return (
    <WidgetLauncherContainer
      mountTo={mountNode}
      position={resolvedPlacement.position}
      layout={isEmbedMode ? "absolute" : layout}
      stack={showLauncher}
      bottom={isEmbedMode ? "0" : resolvedPlacement.bottom || launcherBottom}
      right={isEmbedMode ? "0" : resolvedPlacement.right || launcherRight}
      left={isEmbedMode ? "0" : resolvedPlacement.left || launcherLeft}
      zIndex={resolvedPlacement.zIndex}
      containerId={isEmbedMode ? "" : undefined}
      applyMountStyles={!isEmbedMode}
      applyMountClassName={!isEmbedMode}
    >
      {showLauncher ? (
        <WidgetLauncherButton
          brandName={resolvedName}
          iconUrl={resolvedIconUrl}
          label={resolvedLabel}
          primaryColor={resolvedColor}
          onClick={handleToggle}
        />
      ) : null}
      <WidgetLauncherIframe
        position={isEmbedMode ? "bottom-left" : resolvedPlacement.position}
        layout={iframeLayout}
        bottomOffset={isEmbedMode ? "0" : isMobile ? "0" : resolvedPlacement.bottomOffset}
        sideOffset={isEmbedMode ? "0" : isMobile ? "0" : resolvedPlacement.sideOffset}
        width={isEmbedMode ? iframeWidth : isMobile ? "100vw" : undefined}
        height={isEmbedMode ? iframeHeight : isMobile ? "var(--mejai-vh, 100vh)" : undefined}
        borderRadius={isEmbedMode ? iframeBorderRadius : isMobile ? "0" : undefined}
        boxShadow={isEmbedMode ? iframeBoxShadow : isMobile ? "none" : undefined}
        background={iframeBackground}
        style={iframeStyle}
        isOpen={resolvedOpen}
        src={iframeSrc}
        iframeRef={iframeRef}
        onLoad={handleIframeLoad}
      />
    </WidgetLauncherContainer>
  );
}

export function mountWidgetLauncher() {
  if (typeof window === "undefined") return;
  const scopedWindow = window as WidgetLauncherWindow;
  const script =
    document.currentScript ||
    (() => {
      const scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();

  const scriptDataset = (script as HTMLScriptElement | null)?.dataset;
  let baseUrl = "";
  try {
    baseUrl = new URL((script as HTMLScriptElement | null)?.src || "").origin;
  } catch {
    baseUrl = "https://mejai.help";
  }

  const isPlainObject = (value: unknown): value is Record<string, any> =>
    Boolean(value && typeof value === "object" && !Array.isArray(value));

  const normalizeConfigList = (input: unknown) => {
    if (Array.isArray(input)) {
      return input.filter(isPlainObject) as Record<string, any>[];
    }
    if (isPlainObject(input)) return [input];
    return [{}];
  };

  const readStringValue = (source: Record<string, any> | null | undefined, keys: string[]) => {
    if (!source) return "";
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };

  const readBooleanValue = (source: Record<string, any> | null | undefined, keys: string[]) => {
    if (!source) return false;
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const trimmed = value.trim().toLowerCase();
        if (trimmed === "1" || trimmed === "true" || trimmed === "yes") return true;
        if (trimmed === "0" || trimmed === "false" || trimmed === "no") return false;
      }
    }
    return false;
  };

  const readObjectValue = (source: Record<string, any> | null | undefined, keys: string[]) => {
    if (!source) return undefined;
    for (const key of keys) {
      const value = source[key];
      if (isPlainObject(value)) return value as Record<string, any>;
    }
    return undefined;
  };

  const stripIdentityKeys = (input: Record<string, any>) => {
    const identityKeys = new Set([
      "widget_id",
      "widgetId",
      "instance_id",
      "instanceId",
      "template_id",
      "templateId",
      "public_key",
      "key",
      "widget_public_key",
      "widgetPublicKey",
      "instance_public_key",
      "instancePublicKey",
      "overrides",
    ]);
    const next: Record<string, any> = {};
    Object.entries(input).forEach(([key, value]) => {
      if (identityKeys.has(key)) return;
      next[key] = value;
    });
    return next;
  };

  const visitorStorageKey = "mejai_widget_visitor_id";
  let visitorId = "";
  try {
    visitorId = localStorage.getItem(visitorStorageKey) || "";
    if (!visitorId) {
      visitorId = `mw_vis_${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(visitorStorageKey, visitorId);
    }
  } catch {
    visitorId = `mw_vis_${Math.random().toString(36).slice(2, 12)}`;
  }

  let mountRetryFrame: number | null = null;
  let mountRetryCount = 0;
  const maxMountRetryCount = 30;

  const resetMountRetry = () => {
    if (mountRetryFrame !== null) {
      cancelAnimationFrame(mountRetryFrame);
      mountRetryFrame = null;
    }
    mountRetryCount = 0;
  };

  const scheduleMountRetry = (input?: unknown) => {
    if (typeof window === "undefined") return;
    if (mountRetryFrame !== null || mountRetryCount >= maxMountRetryCount) return;
    mountRetryCount += 1;
    mountRetryFrame = window.requestAnimationFrame(() => {
      mountRetryFrame = null;
      mountConfigs(input);
    });
  };

  const mountConfigs = (input?: unknown) => {
    const configs = normalizeConfigList(input ?? scopedWindow.mejaiWidget);
    if (!configs.length) {
      resetMountRetry();
      return;
    }

    let hasMissingMountTarget = false;

    configs.forEach((rawCfg) => {
      const cfg = isPlainObject(rawCfg) ? rawCfg : {};
      const overrides = isPlainObject(cfg.overrides) ? (cfg.overrides as Record<string, any>) : null;
      const cfgView = overrides ? { ...overrides, ...cfg } : cfg;

      const widgetId = String(cfg.widget_id || cfg.widgetId || scriptDataset?.widgetId || "").trim();
      const instanceId = String(cfg.instance_id || cfg.instanceId || scriptDataset?.instanceId || "").trim();
      const templateId = String(cfg.template_id || cfg.templateId || scriptDataset?.templateId || "").trim();
      const fallbackPublicKey = String(
        cfg.public_key || cfg.key || scriptDataset?.publicKey || scriptDataset?.key || ""
      ).trim();
      const instancePublicKey = String(
        cfg.instance_public_key || cfg.instancePublicKey || scriptDataset?.instanceKey || fallbackPublicKey
      ).trim();
      const widgetPublicKey = String(
        cfg.widget_public_key || cfg.widgetPublicKey || scriptDataset?.widgetKey || fallbackPublicKey
      ).trim();

      const resolvedWidgetId = widgetId || (!instanceId ? templateId : "");
      if (instanceId) {
        if (!instancePublicKey || !templateId) return;
      } else if (!resolvedWidgetId || !widgetPublicKey) {
        return;
      }

      const entryModeValue = readStringValue(cfgView, ["entry_mode", "entryMode"]).toLowerCase();
      const entryMode: WidgetLauncherEntryMode | undefined =
        entryModeValue === "embed" || entryModeValue === "launcher" ? (entryModeValue as WidgetLauncherEntryMode) : undefined;

      const mountTargetValue = readStringValue(cfgView, ["mount_target", "mountTarget", "mount"]);
      const mountTarget =
        (cfgView as any).mount_target instanceof HTMLElement
          ? ((cfgView as any).mount_target as HTMLElement)
          : (cfgView as any).mountTarget instanceof HTMLElement
            ? ((cfgView as any).mountTarget as HTMLElement)
            : typeof mountTargetValue === "string" && mountTargetValue
              ? document.querySelector(mountTargetValue)
              : null;

      const embedMode = entryMode === "embed" || Boolean(mountTarget);

      if (embedMode && !(mountTarget instanceof HTMLElement)) {
        hasMissingMountTarget = true;
        return;
      }

      const mountNode: HTMLElement =
        embedMode && mountTarget instanceof HTMLElement
          ? mountTarget
          : (() => {
            const existing = document.getElementById("mejai-widget-container");
            if (existing) return existing;
            const next = document.createElement("div");
            document.body.appendChild(next);
            return next;
          })();

      const sessionIdentity = instanceId || resolvedWidgetId || "unknown";
      const sessionStorageKey = `mejai_widget_session_${sessionIdentity}_${visitorId}`;
      let sessionId = "";
      try {
        sessionId = localStorage.getItem(sessionStorageKey) || "";
      } catch {
        sessionId = "";
      }
      const placement = resolveWidgetLauncherPlacement({
        cfg: readObjectValue(cfgView, ["cfg"]),
        launcher: readObjectValue(cfgView, ["launcher"]),
        iframe: readObjectValue(cfgView, ["iframe"]),
        position: readStringValue(cfgView, ["position"]),
        bottom: readStringValue(cfgView, ["bottom"]),
        left: readStringValue(cfgView, ["left"]),
        right: readStringValue(cfgView, ["right"]),
        zIndex: cfgView.zIndex,
        bottomOffset: readStringValue(cfgView, ["bottomOffset", "bottom_offset"]),
        sideOffset: readStringValue(cfgView, ["sideOffset", "side_offset"]),
      });

      const brandName = readStringValue(cfgView, ["brandName", "brand_name"]) || "Mejai";
      const launcherLabel = readStringValue(cfgView, ["launcherLabel", "launcher_label"]) || "💬";

      const tabValue = readStringValue(cfgView, ["tab"]);
      const tab: WidgetConversationTab | undefined =
        tabValue === "chat" || tabValue === "list" || tabValue === "policy" || tabValue === "login"
          ? (tabValue as WidgetConversationTab)
          : undefined;

      const previewMode = readBooleanValue(cfgView, ["preview", "preview_mode", "previewMode"]);
      const previewMeta = readObjectValue(cfgView, ["preview_meta", "previewMeta"]) as
        | { origin?: string; page_url?: string; referrer?: string }
        | undefined;

      const fallbackOverrides = overrides ? null : stripIdentityKeys(cfg);
      const resolvedOverrides =
        overrides && Object.keys(overrides).length > 0
          ? overrides
          : fallbackOverrides && Object.keys(fallbackOverrides).length > 0
            ? fallbackOverrides
            : undefined;
      const runtimeCfg = resolvedOverrides ? { ...cfg, overrides: resolvedOverrides } : cfg;

      const existingRoot = (mountNode as any).__mejaiWidgetRoot;
      const root = existingRoot || createRoot(mountNode);
      if (!existingRoot) {
        (mountNode as any).__mejaiWidgetRoot = root;
      }

      root.render(
        <WidgetLauncherRuntime
          cfg={runtimeCfg}
          baseUrl={baseUrl}
          widgetId={resolvedWidgetId || undefined}
          widgetPublicKey={widgetPublicKey || undefined}
          instanceId={instanceId || undefined}
          instancePublicKey={instancePublicKey || undefined}
          templateId={templateId || undefined}
          visitorId={visitorId}
          sessionId={sessionId}
          sessionStorageKey={sessionStorageKey}
          position={placement.position}
          brandName={brandName}
          launcherLabel={launcherLabel}
          mountNode={mountNode}
          entryMode={entryMode}
          tab={tab}
          previewMode={previewMode}
          previewMeta={previewMeta}
          bottom={placement.bottom}
          left={placement.left}
          right={placement.right}
          zIndex={placement.zIndex}
          bottomOffset={placement.bottomOffset}
          sideOffset={placement.sideOffset}
        />
      );
    });

    if (hasMissingMountTarget) {
      scheduleMountRetry(input);
      return;
    }

    resetMountRetry();
  };

  if (scopedWindow.__mejaiWidgetMount) {
    scopedWindow.__mejaiWidgetMount(scopedWindow.mejaiWidget);
    return;
  }

  scopedWindow.__mejaiWidgetMount = mountConfigs;
  scopedWindow.__mejaiWidgetLoaded = true;
  mountConfigs(scopedWindow.mejaiWidget);
}

export type WidgetHeaderLegoProps = {
  brandName: string;
  status?: string;
  iconUrl?: string | null;
  showLogo?: boolean;
  showStatus?: boolean;
  headerActions?: ReactNode;
  onNewConversation?: () => void;
  showNewConversation?: boolean;
  onClose?: () => void;
  showClose?: boolean;
  closeLabel?: string;
};

export function WidgetHeaderLego({
  brandName,
  status,
  iconUrl,
  showLogo = true,
  showStatus = true,
  headerActions,
  onNewConversation,
  showNewConversation,
  onClose,
  showClose = true,
  closeLabel = "\uB2EB\uAE30",
}: WidgetHeaderLegoProps) {
  const resolvedIcon = iconUrl || "/brand/logo.png";
  const canShowStatus = showStatus && Boolean(status && status.trim().length > 0);
  const canStartNew = Boolean(onNewConversation && showNewConversation);
  const canClose = Boolean(onClose && showClose);

  return (
    <header
      className="flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur"
      parts-lego="WidgetHeaderLego"
    >
      <div className="flex items-center gap-3">
        {showLogo ? (
          <div className="h-9 w-9 rounded-full border border-slate-200 bg-white flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolvedIcon} alt="" className="block h-full w-full object-cover" />
          </div>
        ) : null}
        <div>
          <div className="text-sm font-semibold">{brandName}</div>
          {canShowStatus ? <div className="text-[11px] text-slate-500">{status}</div> : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {headerActions || null}
        {canStartNew ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNewConversation}
            className="h-8 px-3 text-[11px]"
          >
            새 대화
          </Button>
        ) : null}
        {canClose ? (
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 sm:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </header>
  );
}

export type WidgetTabBarLegoProps = {
  activeTab: WidgetConversationTab;
  onTabChange: (tab: WidgetConversationTab) => void;
  showChatTab?: boolean;
  showListTab?: boolean;
  showPolicyTab?: boolean;
  showLoginTab?: boolean;
};

export function WidgetTabBarLego({
  activeTab,
  onTabChange,
  showChatTab = true,
  showListTab = true,
  showPolicyTab = false,
  showLoginTab = false,
}: WidgetTabBarLegoProps) {
  const tabs = [showChatTab, showListTab, showPolicyTab, showLoginTab].filter(Boolean).length;
  if (tabs === 0) return null;
  const tabGridClass =
    tabs === 4 ? "grid-cols-4" : tabs === 3 ? "grid-cols-3" : tabs === 1 ? "grid-cols-1" : "grid-cols-2";
  return (
    <div
      className={cn("grid h-[50px] items-center gap-1 border-t border-slate-200 bg-white px-2 py-1", tabGridClass)}
      parts-lego="WidgetTabBarLego"
    >
      {showChatTab ? (
        <button
          type="button"
          onClick={() => onTabChange("chat")}
          className={cn(
            "flex h-full flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold leading-tight transition-colors",
            activeTab === "chat" ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
          )}
        >
          <MessageCircle className="h-4 w-4" />
          <span>대화</span>
        </button>
      ) : null}
      {showListTab ? (
        <button
          type="button"
          onClick={() => onTabChange("list")}
          className={cn(
            "flex h-full flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold leading-tight transition-colors",
            activeTab === "list" ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
          )}
        >
          <List className="h-4 w-4" />
          <span>리스트</span>
        </button>
      ) : null}
      {showPolicyTab ? (
        <button
          type="button"
          onClick={() => onTabChange("policy")}
          className={cn(
            "flex h-full flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold leading-tight transition-colors",
            activeTab === "policy" ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
          )}
        >
          <Shield className="h-4 w-4" />
          <span>정책</span>
        </button>
      ) : null}
      {showLoginTab ? (
        <button
          type="button"
          onClick={() => onTabChange("login")}
          className={cn(
            "flex h-full flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold leading-tight transition-colors",
            activeTab === "login" ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
          )}
        >
          <LogIn className="h-4 w-4" />
          <span>로그인</span>
        </button>
      ) : null}
    </div>
  );
}

export type WidgetConversationSession = {
  id: string;
  session_code?: string | null;
  started_at?: string | null;
};

export type WidgetHistoryPanelLegoProps = {
  sessions: WidgetConversationSession[];
  sessionsLoading?: boolean;
  sessionsError?: string;
  selectedSessionId?: string | null;
  onSelectSession?: (sessionId: string | null) => void;
  historyMessages: ChatMessage[];
  historyLoading?: boolean;
  title?: string;
};

function formatSessionTime(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function WidgetHistoryPanelLego({
  sessions,
  sessionsLoading = false,
  sessionsError = "",
  selectedSessionId,
  onSelectSession,
  historyMessages,
  historyLoading = false,
  title = "과거 대화 목록",
}: WidgetHistoryPanelLegoProps) {
  const [showThread, setShowThread] = useState(false);
  useEffect(() => {
    if (!selectedSessionId) {
      setShowThread(false);
    }
  }, [selectedSessionId]);
  const isThreadView = Boolean(showThread && selectedSessionId);
  return (
    <div className="h-full min-h-0 flex flex-col bg-white" parts-lego="WidgetHistoryPanelLego">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-[11px] text-slate-500">
        <span>{title}</span>
        {isThreadView ? (
          <button
            type="button"
            onClick={() => {
              setShowThread(false);
              onSelectSession?.(null);
            }}
            className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            목록
          </button>
        ) : null}
      </div>
      {isThreadView ? (
        <div className="flex-1 min-h-0 overflow-hidden bg-slate-50 px-4 py-4">
          {historyLoading ? (
            <div className="text-xs text-slate-500">대화를 불러오는 중...</div>
          ) : historyMessages.length === 0 ? (
            <div className="text-xs text-slate-500">선택된 대화가 없습니다.</div>
          ) : (
            <div className="h-full overflow-auto rounded-xl bg-slate-50 px-2 pb-4 pt-2 scrollbar-hide">
              <ConversationThread
                messages={historyMessages}
                selectedMessageIds={[]}
                selectionEnabled={false}
                onToggleSelection={() => undefined}
                avatarSelectionStyle="both"
                renderContent={(msg) => {
                  if (msg.role === "bot" && msg.richHtml) {
                    return (
                      <div
                        style={{ margin: 0, padding: 0, lineHeight: "inherit", whiteSpace: "normal" }}
                        dangerouslySetInnerHTML={{ __html: msg.richHtml }}
                      />
                    );
                  }
                  if (msg.role === "bot") {
                    return renderBotContent(msg.content);
                  }
                  return msg.content;
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto bg-slate-50 px-2 py-2">
          {sessionsLoading ? (
            <div className="px-2 py-2 text-xs text-slate-500">불러오는 중...</div>
          ) : sessionsError ? (
            <div className="px-2 py-2 text-xs text-rose-500">{sessionsError}</div>
          ) : sessions.length === 0 ? (
            <div className="px-2 py-2 text-xs text-slate-500">대화 기록이 없습니다.</div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => {
                const isActive = session.id === selectedSessionId;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => {
                      setShowThread(true);
                      onSelectSession?.(session.id);
                    }}
                    className={cn(
                      "w-full rounded-md border px-2 py-1 text-left text-xs",
                      isActive
                        ? "border-slate-900 bg-white text-slate-900"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                    )}
                  >
                    <div className="font-semibold">{session.session_code || session.id.slice(0, 8)}</div>
                    <div className="text-[10px] text-slate-400">{formatSessionTime(session.started_at)}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type WidgetConversationLayoutProps = {
  brandName: string;
  status: string;
  iconUrl?: string | null;
  showHeader?: boolean;
  showHeaderLogo?: boolean;
  showHeaderStatus?: boolean;
  headerActions?: ReactNode;
  onNewConversation?: () => void;
  showNewConversation?: boolean;
  onClose?: () => void;
  showClose?: boolean;
  closeLabel?: string;
  chatLegoProps: ConversationModelChatColumnLegoProps;
  setupLegoProps: ConversationModelSetupColumnLegoProps;
  activeTab: WidgetConversationTab;
  onTabChange: (tab: WidgetConversationTab) => void;
  showTabBar?: boolean;
  showChatTab?: boolean;
  showListTab?: boolean;
  showPolicyTab?: boolean;
  showLoginTab?: boolean;
  showChatPanel?: boolean;
  showListPanel?: boolean;
  showPolicyPanel?: boolean;
  showLoginPanel?: boolean;
  loginPanel?: ReactNode;
  policyFallback?: ReactNode;
  sessions: WidgetConversationSession[];
  sessionsLoading?: boolean;
  sessionsError?: string;
  selectedSessionId?: string | null;
  onSelectSession?: (sessionId: string | null) => void;
  historyMessages: ChatMessage[];
  historyLoading?: boolean;
  fill?: boolean;
  className?: string;
};

export function WidgetConversationLayout({
  brandName,
  status,
  iconUrl,
  showHeader = true,
  showHeaderLogo = true,
  showHeaderStatus = true,
  headerActions,
  onNewConversation,
  showNewConversation,
  onClose,
  showClose,
  closeLabel,
  chatLegoProps,
  setupLegoProps,
  activeTab,
  onTabChange,
  showTabBar = true,
  showChatTab = true,
  showListTab = true,
  showPolicyTab = false,
  showLoginTab = false,
  showChatPanel = true,
  showListPanel = true,
  showPolicyPanel = true,
  showLoginPanel = true,
  loginPanel,
  policyFallback,
  sessions,
  sessionsLoading = false,
  sessionsError = "",
  selectedSessionId,
  onSelectSession,
  historyMessages,
  historyLoading = false,
  fill = true,
  className,
}: WidgetConversationLayoutProps) {
  const fallbackPanel = policyFallback ? (
    policyFallback
  ) : (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-white text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      <span>대화 준비중</span>
    </div>
  );
  const canStartNew = typeof showNewConversation === "boolean" ? showNewConversation : Boolean(onNewConversation);

  return (
    <div
      className={cn(
        fill ? "min-h-screen" : "h-full",
        "w-full bg-slate-50 text-slate-900 flex flex-col",
        className
      )}
      parts-lego="WidgetConversationLayout"
    >
      {showHeader ? (
        <WidgetHeaderLego
          brandName={brandName}
          status={status}
          iconUrl={iconUrl}
          showLogo={showHeaderLogo}
          showStatus={showHeaderStatus}
          headerActions={headerActions}
          onNewConversation={onNewConversation}
          showNewConversation={canStartNew}
          onClose={onClose}
          showClose={showClose}
          closeLabel={closeLabel}
        />
      ) : null}
      <div className="flex-1 min-h-0 overflow-hidden" panel-lego="WidgetConversationLayout.Panel">
        {activeTab === "chat" && showChatPanel ? <ConversationModelChatColumnLego {...chatLegoProps} /> : null}
        {activeTab === "list" && showListPanel ? (
          <WidgetHistoryPanelLego
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            sessionsError={sessionsError}
            selectedSessionId={selectedSessionId}
            onSelectSession={onSelectSession}
            historyMessages={historyMessages}
            historyLoading={historyLoading}
          />
        ) : null}
        {activeTab === "policy"
          ? showPolicyTab && showPolicyPanel
            ? <ConversationModelSetupColumnLego {...setupLegoProps} />
            : fallbackPanel
          : null}
        {activeTab === "login"
          ? showLoginTab && showLoginPanel
            ? (loginPanel || fallbackPanel)
            : fallbackPanel
          : null}
      </div>
      {showTabBar ? (
        <WidgetTabBarLego
          activeTab={activeTab}
          onTabChange={onTabChange}
          showChatTab={showChatTab}
          showListTab={showListTab}
          showPolicyTab={showPolicyTab}
          showLoginTab={showLoginTab}
        />
      ) : null}
    </div>
  );
}
