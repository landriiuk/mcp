# Capture MVP — тікети

Мета: шлях **побачив слово → зберіг за секунди → можеш практикувати сьогодні**.  
Позиція з [`PRODUCT-PLAN.md`](./PRODUCT-PLAN.md): ставка A «From clipboard to Known».

Залежності: існуючі `CardEditor`, `Wordbox` «Add card», папки, Quest-пули.

---

## T1 — Quick Add (обов’язковий)

**Що:** компактна форма «швидко додати» без повного редактора.

**UX**
- З активної папки (не All): кнопка **Quick add** поруч з Add card / або primary shortcut.
- Поля: **Word** + **Meaning** (обов’язкові); Example — опційно, згорнуте.
- Folder = поточна папка (без вибору, якщо не All).
- Status завжди `new`.
- Submit: Enter у Meaning → зберегти → очистити Word/Meaning, фокус знову на Word (додати ще одне).
- Esc / Cancel → закрити.
- Після першого збереження — тост або тихий статус «Saved · ready for Quest».

**Не в scope:** tags, status picker, створення папки, AI.

**Acceptance**
- [ ] З папки можна додати картку ≤2 полів за <5 с.
- [ ] Картка з’являється у Cards і входить у Quest pool.
- [ ] Повний CardEditor лишається для edit / rich fields.

**Файли (орієнтовно):** новий `QuickAdd.tsx` / модал; wiring у `Wordbox.tsx` + `App.tsx`.

---

## T2 — Paste word from clipboard (обов’язковий)

**Що:** один тап підставляє текст з буфера в Quick Add.

**UX**
- У Quick Add: кнопка **Paste** біля Word (і опційно Meaning).
- Якщо буфер — один рядок без табів/переносів → у Word.
- Якщо рядок виглядає як `word — meaning` / `word - meaning` / `word\tmeaning` → розбити на Word + Meaning.
- Немає permission / порожній буфер → коротка помилка під полем, без alert.

**Acceptance**
- [ ] Paste одного слова заповнює Word.
- [ ] Paste `apple — яблуко` заповнює обидва поля.
- [ ] Працює в Chromium; у Safari — graceful fallback якщо Clipboard API блокує.

**Файли:** `QuickAdd` + маленький `parseClipboardLexeme.ts`.

---

## T3 — Paste sentence → pick word (бажано в тому ж MVP)

**Що:** вставив речення → вибрав слово → воно стає Word; речення → Example.

**UX**
- У Quick Add вкладка/режим **From sentence**.
- Textarea: paste речення.
- Клік по токену (split по пробілах/пунктуації) → Word = токен, Example = повне речення.
- Meaning лишається ручним (або порожнім з підказкою «add meaning»).
- Не блокувати save без meaning? **Ні** — meaning обов’язковий (як у поточному редакторі).

**Acceptance**
- [ ] З речення можна зібрати Word + Example двома кліками + ввести Meaning.
- [ ] Не ламає T1/T2.

**Файли:** `SentenceCapture.tsx` або режим у `QuickAdd`.

---

## T4 — After-save nudge to practice (опційно, маленький)

**Що:** після Quick Add показати CTA, якщо в папці вже є Quest pool.

**UX**
- Під формою або toast: **Start Quest** (якщо `sessionSize > 0`) / **Back to cards**.
- Не авто-стартити сесію без кліку.

**Acceptance**
- [ ] Один клік веде на Learning Hub або одразу в Quest (краще Hub, щоб не сюрпризити).

---

## Порядок імплементації

```text
T1 Quick Add  →  T2 Clipboard parse  →  T3 Sentence pick  →  T4 Nudge
```

T1+T2 = мінімальний shippable MVP.  
T3 = головний «вау» для ставки A.  
T4 = конверсія в практику.

---

## Поза цим MVP (наступна хвиля)

- AI: meaning / example з LLM  
- Share target (mobile)  
- Browser extension  
- Дедуп «таке слово вже є в папці» з merge UI  

---

## Definition of done (усього MVP)

Користувач може: скопіювати слово з статті → Quick Add → Paste → (опційно) речення як example → Save → Start Learning → Quest того ж дня.
