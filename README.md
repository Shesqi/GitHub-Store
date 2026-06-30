# GitHub Store

Десктопное приложение для поиска, просмотра и скачивания релизов GitHub-репозиториев.

![Main screen](./screenshots/Main%20screen.png)

## Стек

- **React 18** + **TypeScript**
- **Vite** — сборка
- **Electron** — десктопная обёртка
- **Tailwind CSS** — стили
- **Framer Motion** — анимации
- **Lucide React** — иконки
- **react-markdown** + **rehype-raw** + **remark-gfm** — рендеринг README
- **Radix UI** — доступные компоненты (Select, Tabs, Slot)

## Разработка

```bash
# установка зависимостей
npm install

# веб-версия (локальный сервер с HMR)
npm run dev

# десктоп-версия (Electron + HMR)
npm run electron:dev
```

## Сборка

```bash
# собрать web-сборку
npm run build

# собрать десктопные установщики (NSIS + portable)
npm run electron:build
```

Результат сборки — в папке `release/`:
- `GitHub Store Setup 1.0.0.exe` — установщик NSIS
- `GitHub Store 1.0.0.exe` — портативная версия

## Структура

```
src/
├── components/   # UI-компоненты
├── hooks/        # кастомные хуки
├── lib/          # API, утилиты
├── pages/        # страницы (Home, Favorites, RepoDetail)
├── types/        # типы
├── App.tsx
└── main.tsx
electron/
├── main.js       # основной процесс Electron
└── preload.js    # preload-скрипт
```

## Функции

- Поиск репозиториев через GitHub API
- Сортировка: трендовые, горячие, популярные
- Просмотр README с переводом на русский (сохранение блоков кода)
- Список релизов и загрузка файлов
- Избранное (сохраняется локально)
- Уведомления о новых релизах
- Категории репозиториев
- Тёмная тема со стеклянным дизайном
