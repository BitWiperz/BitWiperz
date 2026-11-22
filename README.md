# BitWiperz 🛡️
### Enterprise-Grade Certified Data Sanitization & Asset Decommissioning Platform

[![Rust](https://img.shields.io/badge/Rust-2021_Edition-orange?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2.0-blue?logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%26_Storage-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Compliance](https://img.shields.io/badge/Standards-NIST_SP_800--88_Rev.1_%7C_DoD_5220.22--M-red)](docs/WIPING_STANDARDS_AND_ALGORITHMS.md)

---

## 📑 Documentation Index

For in-depth architectural specifications, compliance standards, and interview preparation guides, explore the documentation suite:

* 🏛️ **[System Architecture & Design Specification](docs/ARCHITECTURE.md)**: Deep dive into the Tauri v2 IPC bridge, Tokio async orchestrator, bare-metal Rust engine, and Express/Supabase cloud backend.
* 🔒 **[Data Sanitization Standards & Erasure Algorithms](docs/WIPING_STANDARDS_AND_ALGORITHMS.md)**: In-depth technical breakdown of NIST 800-88 Clear/Purge, DoD 5220.22-M (3/7-Pass), Gutmann (35-Pass), NVMe Sanitize/Format, ATA Secure Erase, Crypto Erase, and sector sampling verification.
* 🌐 **[Cloud Backend, REST API & Database](docs/API_AND_DATABASE.md)**: REST endpoints, JWT authentication, PostgreSQL schema, Supabase storage buckets, and automated vector PDF generation.
* 🎯 **[Technical Interview Master Guide](docs/INTERVIEW_GUIDE.md)**: 30-second elevator pitch, 2-minute whiteboard walkthrough, top 10 interview questions with model answers, trade-offs, and STAR framework case studies.
* 🎙️ **[Spoken Interview Scripts & Playbook](docs/SPOKEN_INTERVIEW_SCRIPT.md)**: Word-for-word spoken scripts for self-introductions, technical deep dives, behavioral questions, and live interview responses.

---

## 💡 Overview

**BitWiperz** is a dual-tier data sanitization platform engineered for IT Asset Disposition (ITAD) facilities, data center engineers, and field technicians. Standard OS-level deletion and partition reformatting leave raw storage blocks completely intact. Furthermore, modern solid-state drives (SSDs) employ dynamic wear-leveling and over-provisioning that conceal physical NAND cells from conventional software file writes.

BitWiperz solves this challenge by pairing a **low-level bare-metal Rust engine** that interfaces directly with physical storage controllers (`/sys/block`, `nvme-cli`, `hdparm`, `blkdiscard`) with a **tamper-proof cloud attestation backend** that issues cryptographically signed PDF certificates of erasure.

```
┌────────────────────────────────────────────────────────┐
│                   React 19 Frontend                    │
│      Dark-Themed UI • Live Telemetry • Device Table    │
└───────────────────────────┬────────────────────────────┘
                            │ Tauri v2 IPC (Events & Commands)
┌───────────────────────────▼────────────────────────────┐
│              Bare-Metal Engine (Rust Core)             │
│   Tokio Asynchronous Multi-Drive Wiping Orchestrator   │
│   Fail-Safe Host OS & Boot-Drive Exclusion Guards      │
│   ATA Secure Erase • NVMe Sanitize • DoD Multipass     │
└───────────────┬────────────────────────┬───────────────┘
                │ Direct Linux Syscalls  │ REST / HTTPS (JWT)
                ▼                        ▼
┌───────────────────────────┐ ┌──────────────────────────┐
│   Kernel Storage Layer    │ │   Cloud Audit Backend    │
│  /sys/block • nvme • ATA  │ │ Express 5 • Supabase DB  │
│  Raw Block I/O Streaming  │ │ PDF Certificate Engine   │
└───────────────────────────┘ └──────────────────────────┘
```

---

## ⚡ Key Features

* **Multi-Standard Compliance**:
  * **NIST SP 800-88 Rev. 1**: Clear & Purge levels.
  * **DoD 5220.22-M / NISPOM**: 3-Pass (`0x00`, `0xFF`, Random) & 7-Pass ECE Extended overwrite.
  * **Peter Gutmann's Algorithm**: 35-Pass magnetic domain overwrite.
  * **Hardware-Level SSD Sanitization**: NVMe Format / Sanitize (Block Erase & Crypto Erase), ATA Secure Erase, and Block TRIM Discard.
* **Fail-Safe Host Drive Protection**:
  * Dynamically inspects `/proc/mounts` and active binary executable path (`std::env::current_exe()`).
  * Automatically detects and **locks out the host boot drive and OS partitions** to eliminate accidental host wipes.
  * Automatically unmounts target partitions prior to executing block-level commands.
* **Concurrent Multi-Drive Wiping**:
  * Tokio asynchronous runtime executes parallel wipes across multiple storage devices without UI freezing or thread starvation.
  * Granular cooperative cancellation via `tokio_util::sync::CancellationToken`.
* **Field-Ready Kiosk Network Manager**:
  * Integrated Linux `nmcli` wrapper enables field technicians to scan Wi-Fi SSIDs, supply passphrases, and test internet connectivity from within the application in headless or live USB environments.
* **Tamper-Proof Audit Certificates**:
  * Automated sector sampling and SHA-256 verification digest calculation.
  * Server-side SHA-256 digital signature binding drive serial, model, capacity, timestamps, and operator identity.
  * Vector PDF certificate generation using `pdf-lib` with security watermarks and cloud archival.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Desktop Core** | Rust 2021, Tauri v2, Tokio, Serde, SHA-2, libc |
| **Desktop UI** | React 19, TypeScript 5.8, Vite 7, Modern Vanilla CSS Dark Theme |
| **Cloud Backend** | Node.js 20+, Express 5, TypeScript 5.9, `@supabase/supabase-js`, `pdf-lib`, `bcrypt`, `jsonwebtoken` |
| **Database & Storage** | Supabase (PostgreSQL 15+ with Row-Level Security, Private S3-Compatible Buckets) |
| **OS / Hardware Layer** | Linux Block Subsystem (`/sys/block`, `/sys/class/block`), `nvme-cli`, `hdparm`, `blkdiscard`, `nmcli` |

---

## 🚀 Quickstart & Development Setup

### Prerequisites
* **Node.js** >= 20.x & **pnpm** >= 9.x
* **Rust & Cargo** >= 1.75 (`rustup update stable`)
* **Linux System Packages** (for hardware commands):
  ```bash
  sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev hdparm nvme-cli util-linux network-manager
  ```

---

### 1. Cloud Backend Setup

```bash
# Navigate to backend directory
cd BitWiperz/backend

# Create environment configuration
cp .env.example .env

# Edit .env with your Supabase credentials:
# PORT=3000
# JWT_SECRET=your-secure-jwt-secret
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_KEY=your-supabase-service-role-key

# Install dependencies
pnpm install

# Apply database schema in Supabase SQL editor:
# Execute statements from BitWiperz/backend/data/schema.sql

# Start development server
pnpm dev
```
Backend runs at `http://localhost:3000`. Health check available at `http://localhost:3000/health`.

---

### 2. Desktop Application Setup

Because disk sanitization requires raw block access (`/dev/sd*`, `/dev/nvme*`), run the desktop app with elevated privileges:

```bash
# Navigate to desktop directory
cd BitWiperz/desktop

# Install frontend dependencies
pnpm install

# Run application with sudo privileges
bash ./run-with-sudo.sh
```

Alternatively, to run the standard Vite frontend dev server for UI design work:
```bash
pnpm dev
```

---

## 📊 Erasure Technique & Media Compatibility Matrix

| Technique | NVMe SSD | SATA SSD | Magnetic HDD | Removable Flash | Standard Compliance |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **NVMe Secure Erase** | ✅ | ❌ | ❌ | ❌ | NIST SP 800-88 Purge |
| **NVMe Format** | ✅ | ❌ | ❌ | ❌ | NIST SP 800-88 Clear / Purge |
| **ATA Secure Erase** | ❌ | ✅ | ✅ | ❌ | NIST SP 800-88 Purge |
| **Crypto Erase (SED)** | ✅ | ✅ (SED) | ✅ (SED) | ❌ | NIST SP 800-88 Purge / IEEE 2883 |
| **Block Erase (TRIM)** | ✅ | ✅ | ❌ | Optional | NIST SP 800-88 Clear |
| **DoD 5220.22-M (3-Pass)** | ✅ | ✅ | ✅ | ✅ | DoD NISPOM Standard |
| **DoD 5220.22-M (7-Pass)** | ✅ | ✅ | ✅ | ✅ | DoD ECE Standard |
| **Gutmann (35-Pass)** | ✅ | ✅ | ✅ | ✅ | High Security Magnetic HDD |
| **Zero Fill / Single Pass** | ✅ | ✅ | ✅ | ✅ | NIST SP 800-88 Clear |

---

## 📜 License

This project is licensed under the MIT License.