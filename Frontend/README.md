# Vosox Portal - Microfrontend Monorepo

Welcome to the **Vosox Portal** codebase. This repository is built as a microfrontend monorepo using React, Vite, TypeScript, and Module Federation. It utilizes **Zustand** for lightweight, persistent authentication state management.

---

## 🏛️ Project Architecture & Structure

This repository uses npm workspaces to manage a monorepo setup:

```
├── packages
│   ├── host-app           # Container Shell (coordinates routing, sidebar & global auth state)
│   ├── remote-buyer       # Buyer Microfrontend (exposes BuyerApp modules)
│   ├── remote-supplier    # Supplier Microfrontend (exposes SupplierApp modules)
│   └── shared-ui          # Shared Component Library (common buttons, loaders, styles)
```

### Port Assignments (Local Development)
- **Host App**: `https://localhost:6001`
- **Remote Buyer**: `https://localhost:6002`
- **Remote Supplier**: `https://localhost:6003`
- **Remote Platform User**: `https://localhost:6004`

---

## 🔄 State Management

Global authentication state (login/logout, user roles, token synchronization) is managed using **Zustand** in the Host application.

- **Store Path**: `packages/host-app/src/store/useAuthStore.ts`
- **Actions**:
  - `login(role)`: Handles state changes, sets user role (`buyer` | `supplier`), and persists settings to LocalStorage.
  - `logout()`: Clears the state and deletes LocalStorage keys.
- **Hook Export**: Re-exported through [packages/host-app/src/AuthContext.tsx](packages/host-app/src/AuthContext.tsx) to provide backwards compatibility with minimum code modifications.

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js (v18+) and npm installed.

### 1. Install Dependencies
Run from the root of the project to install all monorepo dependencies:
```bash
npm install
```

### 2. Start Local Development
Start the host and remote dev servers concurrently:
```bash
npm run dev
```
Navigate your browser to: **`https://localhost:6001`**

*Note: The dev servers run on HTTPS by default. If your browser warns you about an invalid local certificate, click "Advanced" -> "Proceed to localhost (unsafe)".*

### 3. Build for Production
To build all workspaces and output production bundles:
```bash
npm run build
```

---

## 🌍 Production Deployment & Module Federation

When deploying to production, remotes are hosted at distinct URLs:

1. **Deploy Remotes**: Compile and host `remote-buyer` and `remote-supplier` independently.
2. **Inject URL Environment Variables**: When building `host-app`, inject the environment variables `VITE_REMOTE_BUYER_URL` and `VITE_REMOTE_SUPPLIER_URL`.
3. **On-Demand Loading**: When the browser accesses the host, it dynamically resolves the remotes' entry points (`remoteEntry.js`) at runtime, preventing the need to redeploy the host when updates are pushed to the buyer or supplier apps.
