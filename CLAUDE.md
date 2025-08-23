# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

健常者エミュレータ事例集 (Healthy Person Emulator Case Collection) is a Japanese web application for collecting and sharing implicit knowledge. Built with Remix, TypeScript, PostgreSQL, and TailwindCSS, it emphasizes accessibility, anonymity, and fatigue-friendly design.

## Development Commands

**Primary Development**
- `pnpm dev` - Start development server on localhost:3000
- `pnpm build` - Build production (includes prisma generate)
- `pnpm start` - Start production server

**Code Quality (run after making changes)**
- `pnpm lint` - ESLint with caching
- `pnpm typecheck` - TypeScript type checking  
- `pnpm knip` - Unused code detection

**Testing**
- `pnpm test` - Vitest unit tests
- `npx playwright test` - E2E tests

**Database**
- `pnpm seed` - Seed database
- `pnpm reset:db` - Reset and push schema
- `npx prisma generate` - Generate client after schema changes

## Architecture

**File Structure**
- `app/routes/` - Remix routes using flat-routes convention
- `app/modules/` - Server-side business logic (`.server.ts` files)
- `app/components/` - React components organized by function
- `app/stores/` - Client state management with Jotai
- `app/schemas/` - Zod validation schemas

**Key Patterns**
- Database operations centralized in `modules/db.server.ts`
- Authentication via Remix Auth (Google OAuth + email)
- Search: Server-side full-text + client-side light search + embedding similarity
- State: Server (Remix loaders/actions) + Client (Jotai atoms)
- Import paths: Use `~/*` for internal app imports

**Database**
- PostgreSQL with Prisma ORM and vector extension
- Snake_case columns mapped from camelCase in code
- Models: DimPosts, DimComments, DimTags, Users, etc.

## Development Guidelines

**Code Style**
- TypeScript strict mode, ES2022 target
- ESLint enforces React Hooks, a11y, and import rules
- PascalCase for components, camelCase for utilities
- `.server.ts` suffix for server-only code

**Testing Approach**  
- Unit tests: Vitest with happy-dom (60s timeout)
- E2E tests: Playwright for UI flows
- Test files: `.test.tsx` or `.test.ts`

**Accessibility & UX**
- Follow existing a11y patterns (JSX a11y rules enforced)
- Maintain fatigue-friendly design (simple, minimal information)
- Support Japanese language content
- Ensure responsive mobile/desktop design

**Package Management**
- Uses pnpm (enforced via preinstall hook)
- Node.js 22.12.0 required