# 🤖 Команди бота в Make.com

## Загальна схема сценарію

```
Telegram Trigger → Router → гілка по команді → Notion API → Telegram відповідь
```

Один сценарій обробляє всі команди через **Router** модуль.

---

## /add — додати робітника

**Формат:** `/add 123456789 Іван Петренко 80 5`
(TG ID, ПІБ, ставка/год, ставка/пачку)

**Make сценарій:**
1. `Telegram` — Watch Updates
2. `Router` — фільтр: `text` починається з `/add`
3. `Tools → Text parser` — розбиває на частини:
   ```
   Pattern: /add (\d+) (.+?) (\d+) (\d+)
   Group 1 → tgId
   Group 2 → name
   Group 3 → rateHour
   Group 4 → ratePack
   ```
4. `HTTP → Make a request` → Notion (створити сторінку):
   ```
   URL: https://api.notion.com/v1/pages
   Method: POST
   Headers:
     Authorization: Bearer {{NOTION_TOKEN}}
     Notion-Version: 2022-06-28
   Body:
   {
     "parent": { "database_id": "{{DB_STAFF}}" },
     "properties": {
       "ПІБ":              { "title": [{ "text": { "content": "{{2.group2}}" } }] },
       "ID":               { "number": {{2.group1}} },
       "Ставка в годину":  { "number": {{2.group3}} },
       "Ставка за пачку":  { "number": {{2.group4}} }
     }
   }
   ```
5. `Telegram → Send a message`:
   ```
   ✅ Додано: {{2.group2}}
   🆔 TG ID: {{2.group1}}
   ⏱ Ставка/год: {{2.group3}} грн
   📦 Ставка/пачку: {{2.group4}} грн
   ```

**Захист:** додай фільтр — виконувати тільки якщо `from.id = OWNER_TG_ID`

---

## /rate — змінити ставку

**Формат:** `/rate 123456789 год 90`
або:        `/rate 123456789 пачка 6`

**Make сценарій:**
1. Фільтр: text починається з `/rate`
2. Text parser: `/rate (\d+) (\w+) (\d+)`
   - group1 → tgId
   - group2 → тип (год/пачка)
   - group3 → нова ставка
3. `HTTP` → Notion: знайти сторінку:
   ```
   POST https://api.notion.com/v1/databases/{{DB_STAFF}}/query
   Body:
   {
     "filter": {
       "property": "ID",
       "number": { "equals": {{group1}} }
     }
   }
   ```
4. `HTTP` → Notion: оновити сторінку:
   ```
   PATCH https://api.notion.com/v1/pages/{{3.results[0].id}}
   Body (якщо год):
   {
     "properties": {
       "Ставка в годину": { "number": {{group3}} }
     }
   }
   Body (якщо пачка):
   {
     "properties": {
       "Ставка за пачку": { "number": {{group3}} }
     }
   }
   ```
   ⚠️ Для вибору між год/пачка використай **Router** з двома гілками
5. Telegram відповідь:
   ```
   ✅ Ставку оновлено
   👤 ID: {{group1}}
   💰 Нова ставка: {{group3}} грн
   ```

---

## /list — список всіх робітників зі ставками

**Формат:** `/list`

**Make сценарій:**
1. Фільтр: text = `/list`
2. `HTTP` → Notion query DB_STAFF (без фільтру)
3. `Tools → Text aggregator` — збирає всіх в одне повідомлення:
   ```
   {{item.properties.ПІБ.title[0].plain_text}} — {{item.properties['Ставка в годину'].number}} грн/год, {{item.properties['Ставка за пачку'].number}} грн/пачку
   ```
4. Telegram:
   ```
   👥 Персонал:
   {{aggregated_text}}
   ```

---

## /remove — видалити робітника

**Формат:** `/remove 123456789`

**Make сценарій:**
1. Фільтр: text починається з `/remove`
2. Text parser: `/remove (\d+)` → tgId
3. HTTP → Notion query (знайти сторінку)
4. HTTP → Notion PATCH (архівувати):
   ```
   PATCH https://api.notion.com/v1/pages/{{page_id}}
   Body: { "archived": true }
   ```
5. Telegram: `🗑 Робітника видалено`

---

## Захист всіх команд

В кожному роутері додай перший фільтр:

```
Condition: {{1.message.from.id}} = {{OWNER_TG_ID}}
```

Якщо хтось інший пише команди — бот мовчить або відповідає:
```
⛔️ У вас немає доступу до цієї команди
```

---

## Змінні в Make (зберігай у Data Stores або Variables)

| Змінна | Значення |
|--------|---------|
| NOTION_TOKEN | secret_xxxxx |
| DB_STAFF | ID бази Персонал |
| OWNER_TG_ID | твій Telegram ID |
