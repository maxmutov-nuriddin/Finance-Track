# Финансовый помощник без AI

Детерминированный парсер (правила + regex) для быстрых финансовых записей. Без ML/AI/LLM.

## Стек
- Frontend: React + Vite (JS)
- Backend: Firebase (Auth, Firestore, Cloud Functions)
- Hosting: Firebase Hosting
- Таймзона: Asia/Tashkent

## Быстрый старт

### 1) Создать Firebase проект
1. Создай проект в Firebase Console.
2. Скопируй `projectId`.

### 2) Включить Auth провайдеры
- Firebase Console → Authentication → Sign-in method
- Включи **Google** и **Email/Password**.

### 3) Firestore + rules
- Firebase Console → Firestore Database → Create database.
- В разделе Rules вставь содержимое `firestore.rules`.

### 4) Настроить FCM (Web Push)
1. Firebase Console → Project Settings → Cloud Messaging.
2. Создай Web Push certificate и получи **VAPID key**.
3. В `public/firebase-messaging-sw.js` замени значения `YOUR_*` на реальные.

### 5) ENV переменные фронта
Создай `.env` на основе `.env.example`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
```

### 6) Cloud Functions + Scheduler
1. Установи Firebase CLI и залогинься:
   - `npm i -g firebase-tools`
   - `firebase login`
2. В корне проекта:
   - `firebase use --add`
3. Установи зависимости функций:
   - `cd functions`
   - `npm i`
4. Деплой функций:
   - `firebase deploy --only functions`

Функция `notifyUpcomingPayments` запускается ежедневно в 09:00 Asia/Tashkent.

### 7) Hosting
1. Собери фронт:
   - `npm i`
   - `npm run build`
2. Деплой:
   - `firebase deploy --only hosting`

## Основные сценарии
- Быстрый ввод одной строкой
- История транзакций + фильтры
- Цели с авто-датой
- Платежи + напоминания за 3 дня

## Данные и хранение
- **localStorage не используется**
- Все данные хранятся в Firestore и синхронизируются в реальном времени

## Структура Firestore
```
users/{uid}
users/{uid}/transactions/{transactionId}
users/{uid}/goals/{goalId}
users/{uid}/payments/{paymentId}
users/{uid}/fcmTokens/{tokenId}
```

## Поля
**Transaction**:
- id, createdAt, occurredAt, occurredAtISO, amount, type, category, description, raw

**Goal**:
- id, title, targetAmount, createdAt, manualTargetDateISO?, autoTargetDateISO?, isAutoDate

**Payment**:
- id, title, amount, payDateISO, createdAt, lastNotifiedAtISO

## Уведомления
- После логина открой страницу **Платежи** и нажми “Включить уведомления”.
- FCM token сохраняется в `users/{uid}/fcmTokens/{tokenId}`.
- Ежедневная Cloud Function отправляет уведомления за 3 дня.

## Парсер
Детерминированный разбор (`src/lib/parse.js`):
- суммы: `25 тыс`, `2.5 млн`, `25 000`
- даты: `сегодня/вчера/позавчера/завтра/послезавтра`, `5 дней назад`, `12.01.2026`, `12.01`
- время: `14:30`

## Примеры parseInput()
Примеры рассчитаны при `nowDate = 2026-02-01 12:00 Asia/Tashkent`.

1) `"хот дог 25 тысяч"`
```
{
  amount: 25000,
  occurredAtISO: "2026-02-01T12:00:00+05:00",
  category: "food",
  type: "expense",
  description: "хот дог",
  warnings: []
}
```

2) `"такси 18000 вчера"`
```
{
  amount: 18000,
  occurredAtISO: "2026-01-31T12:00:00+05:00",
  category: "transport",
  type: "expense",
  description: "такси",
  warnings: []
}
```

3) `"зп 4 млн"`
```
{
  amount: 4000000,
  occurredAtISO: "2026-02-01T12:00:00+05:00",
  category: "other",
  type: "income",
  description: "зп",
  warnings: []
}
```

4) `"кредит 350000 15.02.2026"`
```
{
  amount: 350000,
  occurredAtISO: "2026-02-15T12:00:00+05:00",
  category: "credit",
  type: "expense",
  description: "кредит",
  warnings: []
}
```

5) `"кофе 12000 5 дней назад 09:10"`
```
{
  amount: 12000,
  occurredAtISO: "2026-01-27T09:10:00+05:00",
  category: "food",
  type: "expense",
  description: "кофе",
  warnings: []
}
```

## Запуск локально
```
npm i
npm run dev
```
