'use client';

export default function Toast({show, type, text}: {show: boolean; type?: string; text?: string}) {
  return <div className={`floating-toast ${show ? 'show' : ''} ${type || 'success'}`}>{text || ''}</div>;
}
