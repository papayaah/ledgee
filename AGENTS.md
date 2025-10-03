# Agent Development Guidelines

## Do NOT:
- Run development servers (`npm run dev`, `npm start`, etc.)
- Create extensive test files
- Write verbose documentation

## DO:
- Keep code concise and focused
- Make minimal, targeted changes
- Let the user run their own servers
- Focus on solving the immediate problem

## Notes:
- User will handle server execution
- Prefer small, efficient solutions
- Avoid over-engineering
```

---

Now, regarding the sql.js error - the issue is still happening because the webpack configuration isn't properly excluding sql.js from the server bundle. Let me check the current error and fix it: