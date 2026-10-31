// The calculation state is independent of the DOM and can be checked with Node.
export class Calculator {
  constructor() { this.memory = null; this.reset(); }
  reset() {
    this.input = '0'; this.accumulator = null; this.operator = null;
    this.waiting = false; this.finished = false; this.error = false;
    this.lastOperator = null; this.lastOperand = null; this.expression = '';
    this.replaceInput = false;
  }
  number(value) { return Number(Number(value).toPrecision(12)); }
  setNumber(value) {
    if (!Number.isFinite(value)) { this.reset(); this.input = 'Ошибка'; this.error = true; return; }
    this.input = String(this.number(value));
  }
  calculate(a, operator, b) {
    switch (operator) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
    }
  }
  digit(digit) {
    if (this.error || this.finished) this.reset();
    if (this.waiting || this.replaceInput) { this.input = '0'; this.waiting = false; this.replaceInput = false; }
    if (this.input.replace(/[-.]/g, '').length >= 12) return;
    this.input = this.input === '0' ? digit : this.input === '-0' ? '-' + digit : this.input + digit;
  }
  decimal() {
    if (this.error || this.finished) this.reset();
    if (this.waiting || this.replaceInput) { this.input = '0'; this.waiting = false; this.replaceInput = false; }
    if (!this.input.includes('.')) this.input += '.';
  }
  chooseOperator(operator) {
    if (this.error) return;
    if (this.operator && !this.waiting) {
      this.setNumber(this.calculate(this.accumulator, this.operator, Number(this.input)));
      if (this.error) return;
    }
    this.accumulator = Number(this.input); this.operator = operator;
    this.waiting = true; this.finished = false;
    this.lastOperator = null; this.lastOperand = null;
    this.expression = `${this.input} ${operator}`;
  }
  equals() {
    if (this.error) return;
    const operator = this.operator ?? this.lastOperator;
    if (!operator) return;
    const a = this.operator ? this.accumulator : Number(this.input);
    const b = this.operator ? Number(this.input) : this.lastOperand;
    this.setNumber(this.calculate(a, operator, b));
    if (this.error) return;
    this.expression = `${a} ${operator} ${b} =`;
    this.lastOperator = operator; this.lastOperand = b;
    this.operator = null; this.accumulator = null; this.waiting = false; this.finished = true;
  }
  sign() {
    if (this.error) return;
    if (this.waiting) { this.input = '0'; this.waiting = false; }
    this.input = this.input.startsWith('-') ? this.input.slice(1) : '-' + this.input;
    if (this.finished) { this.finished = false; this.lastOperator = null; this.expression = ''; }
  }
  percent() {
    if (this.error) return;
    let value = Number(this.input) / 100;
    if (this.operator === '+' || this.operator === '-') value *= this.accumulator;
    this.setNumber(value); this.waiting = false;
  }
  clear() {
    if (this.error || this.input === '0') { this.reset(); return; }
    this.input = '0'; this.finished = false; this.replaceInput = false; this.lastOperator = null; this.lastOperand = null;
    if (!this.operator) this.expression = '';
  }
  backspace() {
    if (this.error) { this.reset(); return; }
    if (this.waiting || this.finished) return;
    this.replaceInput = false;
    this.input = this.input.slice(0, -1);
    if (!this.input || this.input === '-') this.input = '0';
  }
  updateMemory(value) {
    if (!Number.isFinite(value)) { this.setNumber(NaN); return; }
    this.memory = this.number(value);
    this.replaceInput = true;
  }
  memoryStore() {
    if (!this.error) this.updateMemory(Number(this.input));
  }
  memoryAdd() {
    if (!this.error) this.updateMemory((this.memory ?? 0) + Number(this.input));
  }
  memorySubtract() {
    if (!this.error) this.updateMemory((this.memory ?? 0) - Number(this.input));
  }
  memoryRecall() {
    if (this.memory === null) return;
    if (this.error) this.reset();
    this.setNumber(this.memory);
    this.waiting = false; this.finished = false; this.replaceInput = true;
    this.lastOperator = null; this.lastOperand = null;
    if (!this.operator) this.expression = '';
  }
  memoryClear() { this.memory = null; }
}
