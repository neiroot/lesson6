import { Calculator } from './calculator.js';

const calculator = new Calculator();
const display = document.querySelector('#display');
const expression = document.querySelector('#expression');
const clearButton = document.querySelector('[data-action="clear"]');
const memoryIndicator = document.querySelector('#memory-indicator');
const historyList = document.querySelector('#history-list');
let renderedHistory = null;
const symbols = { '*': '×', '/': '÷', '-': '−', '.': ',' };
const localize = text => text.replace(/[*/.\-]/g, character => symbols[character]);

function render() {
  display.textContent = localize(calculator.input);
  const hasMemory = calculator.memory !== null;
  memoryIndicator.textContent = hasMemory ? `M · ${localize(String(calculator.memory))}` : '';
  memoryIndicator.setAttribute('aria-label', hasMemory ? `В памяти: ${localize(String(calculator.memory))}` : 'Память пуста');
  document.querySelectorAll('[data-action="memoryRecall"], [data-action="memoryClear"]').forEach(button => { button.disabled = !hasMemory; });
  document.querySelectorAll('[data-action="memoryStore"], [data-action="memoryAdd"], [data-action="memorySubtract"]').forEach(button => { button.disabled = calculator.error; });
  expression.textContent = calculator.error ? 'Невозможно выполнить операцию' : localize(calculator.expression);
  clearButton.textContent = calculator.input === '0' || calculator.error ? 'AC' : 'C';
  clearButton.setAttribute('aria-label', clearButton.textContent === 'AC' ? 'Очистить всё' : 'Очистить число');
  if (renderedHistory !== calculator.history) {
    historyList.replaceChildren();
    calculator.history.forEach((entry, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.dataset.action = 'historyRecall';
      button.dataset.value = index;
      button.setAttribute('aria-label', `Вызвать результат: ${localize(entry.expression)} ${localize(entry.result)}`);
      const calculation = document.createElement('span');
      calculation.textContent = localize(entry.expression);
      const result = document.createElement('strong');
      result.textContent = localize(entry.result);
      button.append(calculation, result);
      item.append(button);
      historyList.append(item);
    });
    document.querySelector('#history-count').textContent = calculator.history.length;
    document.querySelector('#history-empty').hidden = calculator.history.length > 0;
    document.querySelector('#history-hint').hidden = calculator.history.length === 0;
    document.querySelector('[data-action="historyClear"]').disabled = calculator.history.length === 0;
    renderedHistory = calculator.history;
  }
  document.querySelectorAll('[data-action="operator"]').forEach(button => {
    button.setAttribute('aria-pressed', String(calculator.waiting && calculator.operator === button.dataset.value));
  });
  display.style.fontSize = '80px';
  const available = display.parentElement.clientWidth - 16;
  if (display.scrollWidth > available) display.style.fontSize = `${Math.max(20, 80 * available / display.scrollWidth)}px`;
}

function activate(action, value) {
  if (action === 'operator') calculator.chooseOperator(value);
  else if (action === 'digit') calculator.digit(value);
  else if (action === 'historyRecall') calculator.historyRecall(Number(value));
  else calculator[action]();
  render();
}

document.querySelector('.calculator').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button) activate(button.dataset.action, button.dataset.value);
});

document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  if (event.key === 'Enter' && event.target.closest('summary')) return;
  // Let Enter activate the focused button through its native click behavior.
  if (event.key === 'Enter' && event.target.closest('button')) return;
  let action, value;
  if (/^\d$/.test(event.key)) { action = 'digit'; value = event.key; }
  else if (['+', '-', '*', '/'].includes(event.key)) { action = 'operator'; value = event.key; }
  else if (event.key === '.' || event.key === ',') action = 'decimal';
  else if (event.key === '=' || event.key === 'Enter') action = 'equals';
  else if (event.key === 'Escape') { event.preventDefault(); calculator.reset(); render(); return; }
  else if (event.key === 'Backspace') action = 'backspace';
  else if (event.key === '%') action = 'percent';
  if (!action) return;
  event.preventDefault(); activate(action, value);
  const button = [...document.querySelectorAll('button')].find(button => button.dataset.action === action && (value === undefined || button.dataset.value === value));
  if (button) { button.classList.add('pressed'); setTimeout(() => button.classList.remove('pressed'), 120); }
});

window.addEventListener('resize', render);
render();
