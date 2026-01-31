# Directive: Build SME TalentFlow (SaaS ATS)

## Project Overview
We are building a Node.js/React SaaS application for recruitment.
**Goal:** A "Zero-to-Hero" hiring platform for SMEs that automates job posting, screening, and scheduling.
**Monetization:** Users must pay a subscription (Stripe) to access the dashboard.
**Tech Stack:** Node.js (Express), React, SQLite (File-based DB for Hostinger), Gemini API (Intelligence).

## Phase 1: The Secure Core (SaaS Foundation)
- **Auth:** Implement simple Email/Password login + Google OAuth.
- **Payment:** Integrate Stripe Checkout.
    - *Rule:* If `user.subscription` is NOT 'active', redirect all dashboard routes to `/pricing`.
- **Database:** Setup `sqlite3`. Create tables for `Users`, `Jobs`, `Candidates`.

## Phase 2: The "Smart" Job Engine
- **Dashboard:** Create a clean UI to list user's jobs.
- **Create Job Flow:**
    - Input: Job Title + Rough Notes.
    - **Action:** Use `execution/draft_job.js` (Gemini) to rewrite notes into a professional JD.
    - Output: Editable Text Editor.
- **Job Status:** Toggle buttons for [Draft, Scheduled, Published, Closed].

## Phase 3: Candidate Portal & Capture
- **Public Page:** Generate a dynamic route `/apply/:jobId`.
- **Custom Form:** Allow users to toggle required fields (Resume, LinkedIn, Portfolio).
- **Chatbot Widget:**
    - Embed a floating chat bubble on the bottom right.
    - *Logic:* Ask 3 screening questions defined by the user (e.g., "Do you have 3 years exp?").
    - Store chat transcript with the candidate application.

## Phase 4: The "Brain" (Resume Parsing & Matching)
- **Upload:** Secure file upload for PDF/Docx.
- **Processing (The Core Feature):**
    - Trigger `execution/parse_resume.js` upon upload.
    - **Extraction:** OCR the text -> Send to Gemini.
    - **Output:** Extract {Name, Email, Phone, Skills[], Experience_Years}.
    - **Analysis:** Compare `Resume` vs `Job Description`. Generate a `Match_Score` (0-100) and a `3-Bullet Summary`.
    - **Talent Pool:** Flag candidates with Score > 85 as "Top Talent" in the database.

## Phase 5: Pipeline & Scheduling
- **Kanban Board:** UI with columns: [Applied] -> [Screening] -> [Interview] -> [Offer] -> [Rejected].
- **Drag & Drop:** Moving a candidate triggers actions (e.g., moving to "Rejected" prompts "Draft Rejection Email").
- **Scheduling:**
    - Integration: Allow users to paste their Calendly Link.
    - **Automation:** When a candidate books a slot (via Calendly Webhook), update status to "Interview Scheduled".
- **Google Calendar:** Add a "Connect G-Cal" button to view availability inside the dashboard.

## Phase 6: Deployment Prep
- **Build:** Create a `build_hostinger.js` script to compile React and organize backend files into a single `public_html` folder.
- **Environment:** Ensure all API keys are referenced via `process.env`.
