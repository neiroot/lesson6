import test from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from './calculator.js';

function enter(c, value) {
  for (const digit of String(value)) digit === '.' ? c.decimal() : c.digit(digit);
}

test('основные операции и последовательные вычисления', () => {
  for (const [operator, result] of [['+', '13'], ['-', '5'], ['*', '36'], ['/', '2.25']]) {
    const c = new Calculator(); enter(c, 9); c.chooseOperator(operator); enter(c, 4); c.equals();
    assert.equal(c.input, result);
  }
  const c = new Calculator(); enter(c, 2); c.chooseOperator('+'); enter(c, 3); c.chooseOperator('*'); enter(c, 4); c.equals();
  assert.equal(c.input, '20');
});

test('дроби, повтор равно и ввод после результата', () => {
  const c = new Calculator(); enter(c, '0.1'); c.chooseOperator('+'); enter(c, '0.2'); c.equals();
  assert.equal(c.input, '0.3'); c.equals(); assert.equal(c.input, '0.5');
  enter(c, 7); assert.equal(c.input, '7');
});

test('проценты с учётом текущей операции', () => {
  for (const [operator, result] of [['+', '220'], ['-', '180'], ['*', '20'], ['/', '2000']]) {
    const c = new Calculator(); enter(c, 200); c.chooseOperator(operator); enter(c, 10); c.percent(); c.equals();
    assert.equal(c.input, result);
  }
  const c = new Calculator(); enter(c, 50); c.percent(); assert.equal(c.input, '0.5');
});

test('ошибка деления на ноль и восстановление', () => {
  const c = new Calculator(); enter(c, 1); c.chooseOperator('/'); enter(c, 0); c.equals();
  assert.equal(c.input, 'Ошибка'); enter(c, 8); assert.equal(c.input, '8'); assert.equal(c.error, false);
});

test('очистка текущего числа, полный сброс, удаление и смена знака', () => {
  const c = new Calculator(); enter(c, 12); c.chooseOperator('+'); enter(c, 34); c.clear();
  assert.equal(c.input, '0'); assert.equal(c.operator, '+');
  enter(c, 56); c.backspace(); assert.equal(c.input, '5');
  c.sign(); assert.equal(c.input, '-5'); c.equals(); assert.equal(c.input, '7');
  c.clear(); c.clear(); assert.equal(c.operator, null); assert.equal(c.input, '0');
});

test('смена операции, повтор запятой и ограничение длины', () => {
  const c = new Calculator(); enter(c, 8); c.chooseOperator('+'); c.chooseOperator('-'); enter(c, 2); c.equals();
  assert.equal(c.input, '6'); c.reset(); c.decimal(); c.decimal(); enter(c, 5); assert.equal(c.input, '0.5');
  c.reset(); enter(c, '123456789012345'); assert.equal(c.input, '123456789012');
});
