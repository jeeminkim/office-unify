import { useState } from 'react';
import { Copy, Check, XCircle } from 'lucide-react';
import { logDevError } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language = 'typescript' }: CodeBlockProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (err) {
      logDevError('복사 실패', err);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 3000);
    }
  };

  return (
    <div className="relative group rounded-md overflow-hidden bg-slate-900 border border-slate-800 my-4 max-h-[600px] flex flex-col">
      <div className="flex justify-between items-center px-4 py-2 bg-slate-800/50 flex-none">
        <span className="text-xs text-slate-400">{language}</span>
        <button
          onClick={handleCopy}
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
        >
          {copyState === 'copied' && (
            <>
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-green-500">복사됨</span>
            </>
          )}
          {copyState === 'error' && (
            <>
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400">복사 실패</span>
            </>
          )}
          {copyState === 'idle' && (
            <>
              <Copy className="w-4 h-4" />
              <span>코드 복사</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-auto text-sm text-slate-50 font-mono flex-1 whitespace-pre">
        <code>{code}</code>
      </div>
    </div>
  );
}
