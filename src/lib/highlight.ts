/**
 * Custom highlight.js bundle with only the languages relevant for
 * a coding-assistant chat UI. This replaces `highlight.js/lib/common`
 * (36 languages) with a focused subset (~16), cutting bundle size significantly.
 */
import hljs from 'highlight.js/lib/core';
import type { LanguageFn } from 'highlight.js';

// Languages commonly seen in AI assistant conversations
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('css', css);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('go', go);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('java', java);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('python', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);

// Aliases for hljs direct usage (ToolCall.tsx)
hljs.registerAliases(['sh', 'zsh'], { languageName: 'bash' });
hljs.registerAliases(['h'], { languageName: 'c' });
hljs.registerAliases(['cc', 'cxx', 'c++', 'hpp', 'hxx'], { languageName: 'cpp' });
hljs.registerAliases(['js', 'jsx'], { languageName: 'javascript' });
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });
hljs.registerAliases(['py'], { languageName: 'python' });
hljs.registerAliases(['html'], { languageName: 'xml' });
hljs.registerAliases(['yml'], { languageName: 'yaml' });
hljs.registerAliases(['toml', 'cfg', 'conf'], { languageName: 'ini' });
hljs.registerAliases(['rs'], { languageName: 'rust' });

/**
 * Language map for rehype-highlight (used in ChatMessage.tsx).
 * rehype-highlight uses lowlight internally and accepts a `languages` record.
 */
export const rehypeHighlightLanguages: Record<string, LanguageFn> = {
  bash, c, cpp, css, diff, dockerfile, go, ini, java, javascript, json,
  markdown, python, rust, shell, sql, typescript, xml, yaml,
};

/**
 * rehype-highlight options with our custom language subset.
 */
export const rehypeHighlightOptions = {
  languages: rehypeHighlightLanguages,
  aliases: {
    bash: ['sh', 'zsh'],
    c: ['h'],
    cpp: ['cc', 'cxx', 'c++', 'hpp', 'hxx'],
    javascript: ['js', 'jsx'],
    typescript: ['ts', 'tsx'],
    python: ['py'],
    xml: ['html'],
    yaml: ['yml'],
    ini: ['toml', 'cfg', 'conf'],
    rust: ['rs'],
  },
} as const;

export default hljs;
