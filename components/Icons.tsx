export const Logo = () => {
  return <div className="size-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxODAiIGhlaWdodD0iMTgwIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQwIDEwKSI+PHBhdGggc3Ryb2tlPSIjRkZGIiBzdHJva2UtbGluZWNhcD0ic3F1YXJlIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjgiIGQ9Ik05NCAxMThhOCA4IDAgMCAxLTggOEg4YTggOCAwIDAgMS04LThWNDBhOCA4IDAgMCAxIDgtOCIvPjxwYXRoIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2Utd2lkdGg9IjgiIGQ9Im05My41IDc3LjUuOTUgMzcuOTg4TTcgMzIuNWg0My41Ii8+PHBhdGggZmlsbD0iI0ZGRiIgZmlsbC1ydWxlPSJub256ZXJvIiBkPSJtMTQgMTAzIDE3LjI1LTIyLjY2NyAxNy4yNSAxN0w2NS43NSA2OSA4MyAxMDN6Ii8+PGNpcmNsZSBjeD0iMzIuNSIgY3k9IjYwLjUiIHI9IjcuNSIgZmlsbD0iI0ZGRiIgZmlsbC1ydWxlPSJub256ZXJvIi8+PHBhdGggZmlsbD0iI0ZGRiIgZmlsbC1ydWxlPSJub256ZXJvIiBkPSJNOTMuNTU1IDBjMCAxOS4wNTQtMTUuNDEzIDM0LjUtMzQuNDI3IDM0LjUgMTkuMDE0IDAgMzQuNDI3IDE1LjQ0NiAzNC40MjcgMzQuNSAwLTE5LjA1NCAxNS40MTQtMzQuNSAzNC40MjgtMzQuNS0xOS4wMTQgMC0zNC40MjgtMTUuNDQ2LTM0LjQyOC0zNC41Ii8+PC9nPjwvc3ZnPg==')] bg-cover"></div>
}

export const Icon4x = ({ className }: { className?: string }) => (
  <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
  >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M5 7v8h5" />
      <path d="M9 7v10" />
      <path d="M14 7l5 8" />
      <path d="M14 15l5 -8" />
  </svg>
);
