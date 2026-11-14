/**
 * Actionable Google Auth Error Banner
 * - Shows clear instructions, current domain copy button, and direct Firebase Console link
 *   when deployed to an external host (e.g. Vercel) not yet added to Authorized Domains.
 */

import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink } from 'lucide-react';
import {
  FIREBASE_AUTH_SETTINGS_URL,
  GoogleAuthActionError,
} from '../firebase/client';

interface AuthErrorNoticeProps {
  error: unknown;
  className?: string;
}

export const AuthErrorNotice: React.FC<AuthErrorNoticeProps> = ({
  error,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  if (!error) return null;

  const isAuthErr = error instanceof GoogleAuthActionError;
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
      ? error.message
      : 'Google Sign-In failed.';

  const host =
    isAuthErr && error.unauthorizedHost
      ? error.unauthorizedHost
      : message.includes('unauthorized-domain') || message.includes('Authorized Domains')
      ? typeof window !== 'undefined'
        ? window.location.hostname
        : ''
      : '';

  const isUnauthorizedDomain =
    (isAuthErr && error.code === 'auth/unauthorized-domain') ||
    message.includes('unauthorized-domain') ||
    message.includes('Authorized Domains');

  const handleCopyDomain = async () => {
    if (!host) return;
    try {
      await navigator.clipboard.writeText(host);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className={`p-3 rounded-xl bg-rose-950/60 border border-rose-500/45 text-[11px] font-mono-tech text-rose-100 space-y-2 text-left ${className}`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed break-words">{message}</div>
      </div>

      {isUnauthorizedDomain && host && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-500/25">
          <button
            type="button"
            onClick={handleCopyDomain}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" /> Copied: {host}
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> Copy Domain ({host})
              </>
            )}
          </button>
          <a
            href={FIREBASE_AUTH_SETTINGS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-[11px] font-semibold flex items-center gap-1.5 transition"
          >
            <ExternalLink className="w-3 h-3" /> Open Firebase Auth Settings
          </a>
        </div>
      )}
    </div>
  );
};
