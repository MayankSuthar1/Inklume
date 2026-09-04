'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { InklumeLogo } from '@/components/inklume-logo';

export function LandingView() {
  const { signIn, loading, error, clearError } = useAuth();

  return (
    <main
      id="landing-container"
      className="min-h-screen flex flex-col justify-between px-6 py-12 md:px-16 md:py-20 max-w-5xl mx-auto selection:bg-[#1F4B43] selection:text-[#F5F1E8]"
    >
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-[#211F1C]/10 pb-6">
        <InklumeLogo size="lg" />
      </header>

      {/* Hero / Philosophy Section */}
      <section className="my-auto py-12 md:py-24 max-w-2xl">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif italic mb-6 leading-tight text-[#211F1C]">
          A quiet desk for thinking out loud.
        </h1>

        <p className="text-lg sm:text-xl font-sans text-[#211F1C]/70 leading-relaxed mb-10">
          Untangle thoughts, record honest reflections, and brainstorm with an attentive partner.
          Your private entries remain strictly yours, stored in your own isolated partition.
        </p>

        {/* Error Notification */}
        {error && (
          <div
            id="auth-error-banner"
            role="alert"
            className="mb-8 p-4 bg-[#F9EBE7] border-l-2 border-[#B3432B] text-[#B3432B] text-sm flex items-center justify-between rounded-xs"
          >
            <span>{error}</span>
            <button
              id="clear-auth-error-btn"
              onClick={clearError}
              className="text-xs uppercase tracking-widest font-bold underline hover:opacity-80 ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Sign in action - strictly Google federated provider, no password form */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            id="google-signin-btn"
            type="button"
            onClick={signIn}
            disabled={loading}
            className="inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-[#1F4B43] hover:bg-[#163630] text-[#FAF7F0] text-[11px] font-bold tracking-widest uppercase rounded-full transition-all disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {loading ? (
              <>
                <span
                  className="w-4 h-4 rounded-full border-2 border-[#FAF7F0] border-t-transparent animate-spin inline-block"
                  aria-hidden="true"
                />
                <span>Opening journal...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <span className="text-[10px] font-bold tracking-widest uppercase text-[#211F1C]/40">
            No password creation or tracking cookies
          </span>
        </div>
      </section>
    </main>
  );
}
