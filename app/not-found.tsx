import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#211F1C] flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-serif italic mb-3">Page not found</h1>
      <p className="text-sm text-[#211F1C]/60 mb-6 max-w-sm">
        The journal entry or page you were looking for could not be found.
      </p>
      <Link
        href="/"
        className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-[#1F4B43] text-[#FAF7F0] rounded-full hover:bg-[#183B34] transition-colors"
      >
        Return to Journal
      </Link>
    </div>
  );
}
