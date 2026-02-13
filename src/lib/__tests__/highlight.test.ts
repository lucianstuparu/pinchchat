import { describe, it, expect } from 'vitest';
import hljs, { rehypeHighlightLanguages, rehypeHighlightOptions } from '../highlight';

describe('highlight', () => {
  const expectedLanguages = [
    'bash', 'c', 'cpp', 'css', 'diff', 'dockerfile', 'go', 'ini',
    'java', 'javascript', 'json', 'markdown', 'python', 'rust',
    'shell', 'sql', 'typescript', 'xml', 'yaml',
  ];

  describe('hljs instance', () => {
    it('has all expected languages registered', () => {
      const registered = hljs.listLanguages();
      for (const lang of expectedLanguages) {
        expect(registered).toContain(lang);
      }
    });

    it('resolves common aliases', () => {
      const aliases = ['sh', 'zsh', 'h', 'cc', 'cxx', 'js', 'jsx', 'ts', 'tsx', 'py', 'html', 'yml', 'rs'];
      for (const alias of aliases) {
        const lang = hljs.getLanguage(alias);
        expect(lang, `alias "${alias}" should resolve`).toBeDefined();
      }
    });

    it('highlights JavaScript code', () => {
      const result = hljs.highlight('const x = 42;', { language: 'javascript' });
      expect(result.value).toContain('hljs-');
      expect(result.language).toBe('javascript');
    });

    it('highlights Python code', () => {
      const result = hljs.highlight('def hello():\n  pass', { language: 'python' });
      expect(result.value).toContain('hljs-');
    });

    it('auto-detects language', () => {
      const result = hljs.highlightAuto('{"key": "value"}');
      expect(result.language).toBe('json');
    });
  });

  describe('rehypeHighlightLanguages', () => {
    it('exports all expected languages as functions', () => {
      for (const lang of expectedLanguages) {
        expect(typeof rehypeHighlightLanguages[lang]).toBe('function');
      }
    });
  });

  describe('rehypeHighlightOptions', () => {
    it('has languages and aliases', () => {
      expect(rehypeHighlightOptions.languages).toBeDefined();
      expect(rehypeHighlightOptions.aliases).toBeDefined();
    });

    it('aliases map to valid language names', () => {
      for (const [lang] of Object.entries(rehypeHighlightOptions.aliases)) {
        expect(expectedLanguages).toContain(lang);
      }
    });
  });
});
