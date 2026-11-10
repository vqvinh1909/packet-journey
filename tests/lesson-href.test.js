import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonHref } from '../ui/i18n.js';

test('lessonHref: bài học trỏ vào HTML giáo trình trong thư mục Mạng máy tính', () => {
  const href = lessonHref('../Network security/Module-01/Bai-05_Abc.md');
  assert.equal(decodeURI(href), '../Mạng máy tính/Network security/Network-Security-Giao-trinh.html#b05-s1');
});

test('lessonHref: mỗi đề CCNP trỏ vào HTML riêng của đề đó', () => {
  const enarsi = lessonHref('../CCNP/Module-02_ENARSI/Bai-11_BGP.md');
  assert.equal(decodeURI(enarsi), '../Mạng máy tính/CCNP/CCNP-ENARSI-Giao-trinh.html#b11-s0');
  const encor = lessonHref('../CCNP/Module-01_ENCOR/Bai-11_Multicast.md');
  assert.equal(decodeURI(encor), '../Mạng máy tính/CCNP/CCNP-ENCOR-Giao-trinh.html#b11-s0');
  const ensld = lessonHref('../CCNP/Module-03_ENSLD/Bai-02_Thiet-ke-IS-IS.md');
  assert.equal(decodeURI(ensld), '../Mạng máy tính/CCNP/CCNP-ENSLD-Giao-trinh.html#b02-s0');
  const enauto = lessonHref('../CCNP/Module-04_ENAUTO/Bai-12_Jinja2.md');
  assert.equal(decodeURI(enauto), '../Mạng máy tính/CCNP/CCNP-ENAUTO-Giao-trinh.html#b12-s0');
  const ensdwi = lessonHref('../CCNP/Module-05_ENSDWI/Bai-16_Application-aware-routing.md');
  assert.equal(decodeURI(ensdwi), '../Mạng máy tính/CCNP/CCNP-ENSDWI-Giao-trinh.html#b16-s0');
  const encc = lessonHref('../CCNP/Module-06_ENCC/Bai-13_BGP-OSPF-voi-cloud.md');
  assert.equal(decodeURI(encc), '../Mạng máy tính/CCNP/CCNP-ENCC-Giao-trinh.html#b13-s0');
  const enna = lessonHref('../CCNP/Module-07_ENNA/Bai-17_Chan-doan-web-waterfall.md');
  assert.equal(decodeURI(enna), '../Mạng máy tính/CCNP/CCNP-ENNA-Giao-trinh.html#b17-s0');
  const wlcor = lessonHref('../CCNP/Module-08_WLCOR/Bai-14_AP-join.md');
  assert.equal(decodeURI(wlcor), '../Mạng máy tính/CCNP/CCNP-WLCOR-Giao-trinh.html#b14-s0');
  const wlsd = lessonHref('../CCNP/Module-09_WLSD/Bai-24_Site-tag.md');
  assert.equal(decodeURI(wlsd), '../Mạng máy tính/CCNP/CCNP-WLSD-Giao-trinh.html#b24-s0');
  const wlsi = lessonHref('../CCNP/Module-10_WLSI/Bai-24_CWA.md');
  assert.equal(decodeURI(wlsi), '../Mạng máy tính/CCNP/CCNP-WLSI-Giao-trinh.html#b24-s0');
  const scor = lessonHref('../CCNP/Module-11_SCOR/Bai-17_Chinh-sach-FTD.md');
  assert.equal(decodeURI(scor), '../Mạng máy tính/CCNP/CCNP-SCOR-Giao-trinh.html#b17-s0');
  const dccor = lessonHref('../CCNP/Module-12_DCCOR/Bai-07_VXLAN-EVPN.md');
  assert.equal(decodeURI(dccor), '../Mạng máy tính/CCNP/CCNP-DCCOR-Giao-trinh.html#b07-s0');
  const spcor = lessonHref('../CCNP/Module-13_SPCOR/Bai-29_SR-segment-va-control-plane.md');
  assert.equal(decodeURI(spcor), '../Mạng máy tính/CCNP/CCNP-SPCOR-Giao-trinh.html#b29-s0');
  const clcor = lessonHref('../CCNP/Module-14_CLCOR/Bai-20_Route-pattern-va-E164.md');
  assert.equal(decodeURI(clcor), '../Mạng máy tính/CCNP/CCNP-CLCOR-Giao-trinh.html#b20-s0');
});

test('lessonHref: file ngoài dạng Bai-NN vẫn đúng thư mục và được encode', () => {
  const href = lessonHref('../Quản trị/Lab Tonghop/Lab-01.md');
  assert.equal(decodeURI(href), '../Mạng máy tính/Quản trị/Lab Tonghop/Lab-01.md');
  assert.ok(!href.includes(' '));
});

test('lessonHref: giáo trình Hạ tầng, Bài 31 trở đi nằm sau Mini Lab và Lab tổng hợp (b44)', () => {
  const B = '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/x/';
  assert.match(decodeURI(lessonHref(`${B}Bai-30_x.md`)), /#b30-s0$/);
  assert.match(decodeURI(lessonHref(`${B}Bai-31_x.md`)), /#b44-s0$/);
  assert.match(decodeURI(lessonHref(`${B}Bai-36_x.md`)), /#b49-s0$/);
});
