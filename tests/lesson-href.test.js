import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonHref } from '../ui/i18n.js';

test('lessonHref: bài học trỏ vào HTML giáo trình trong thư mục Mạng máy tính', () => {
  const href = lessonHref('../Network security/Module-01/Bai-05_Abc.md');
  assert.equal(decodeURI(href), '../Mạng máy tính/Network security/Network-Security-Giao-trinh.html#b05-s0');
});

test('lessonHref: file ngoài dạng Bai-NN vẫn đúng thư mục và được encode', () => {
  const href = lessonHref('../Quản trị/Lab Tonghop/Lab-01.md');
  assert.equal(decodeURI(href), '../Mạng máy tính/Quản trị/Lab Tonghop/Lab-01.md');
  assert.ok(!href.includes(' '));
});
