import Reveal from 'reveal.js'
import RevealMarkdown from 'reveal.js/plugin/markdown'
import RevealHighlight from 'reveal.js/plugin/highlight'
import RevealNotes from 'reveal.js/plugin/notes'

import 'reveal.js/reset.css'
import 'reveal.js/reveal.css'
import 'reveal.js/theme/night.css'
import './dark.css'
import './style.css'

import slides from '../slides.md?raw'

// reveal.js markdown plugin reads inline markdown from a <textarea data-template>
const section = document.querySelector('.slides > section[data-markdown]')
const template = document.createElement('textarea')
template.setAttribute('data-template', '')
template.textContent = slides
section.appendChild(template)

// More info about initialization & config:
// - https://revealjs.com/initialization/
// - https://revealjs.com/config/
Reveal.initialize({
  hash: true,
  width: 1500,
  // Learn about plugins: https://revealjs.com/plugins/
  plugins: [RevealMarkdown, RevealHighlight, RevealNotes],
})
