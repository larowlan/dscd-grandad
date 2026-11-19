import Reveal from 'reveal.js'
import RevealMarkdown from 'reveal.js/plugin/markdown'
import RevealHighlight from 'reveal.js/plugin/highlight'
import RevealNotes from 'reveal.js/plugin/notes'

import 'reveal.js/reset.css'
import 'reveal.js/reveal.css'
import 'reveal.js/theme/night.css'
import './light.css'
import './style.css'

import slides from '../slides.md?raw'

// reveal.js markdown plugin reads inline markdown from a <textarea data-template>
const section = document.querySelector('.slides > section[data-markdown]')
const template = document.createElement('textarea')
template.setAttribute('data-template', '')
// Blank lines inside <pre> end the markdown HTML block, turning the rest of the
// code into <p>. Swap them for a zero-width space line to keep the block open
// (the highlight plugin escapes HTML, so a comment would show as text). The
// placeholder is stripped again once highlighting has run.
template.textContent = slides.replace(/<pre[\s\S]*?<\/pre>/g, (m) =>
  m.replace(/\n[ \t]*(?=\n)/g, '\n\u200b'))
section.appendChild(template)

// More info about initialization & config:
// - https://revealjs.com/initialization/
// - https://revealjs.com/config/
Reveal.on('ready', () => {
  document.querySelectorAll('.reveal pre code').forEach((code) => {
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      n.nodeValue = n.nodeValue.replace(/\u200b/g, '')
    }
  })
})

Reveal.initialize({
  hash: true,
  width: 1500,
  // Learn about plugins: https://revealjs.com/plugins/
  plugins: [RevealMarkdown, RevealHighlight, RevealNotes],
})
