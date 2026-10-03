# Project brief 06: Eco Jobs + Eco Learn

## Overview

Eco Jobs connects people to verified jobs/gigs; Eco Learn helps them build skills relevant to those opportunities. They share a consented skills/profile contract, while keeping course delivery, employer listings and job applications as distinct records and permissions.

## What exists now

Opportunity cards and saves are present in local UI/browser state. There is no sourced, persisted employer/opportunity/application service and no course/assessment/credential system.

## User journey

Employer submits organization and listing evidence → staff verifies employer/listing → job seeker searches by skills, locality, schedule and eligibility → sees why a result fits and its closing date/source → saves/applies on or off platform → application status is shown only when the employer reports it → optional course/assessment shows skill gaps and verified completion → the user chooses whether to attach a credential to an application.

## Scope

**Eco Jobs:** jobs, gigs, internships, grants/scholarships only in clearly labeled categories; employer profiles; source/verification, deadlines, eligibility, location/remote, pay range/currency, application destination, saved items, alerts, scam reporting and expiration.

**Eco Learn:** curated short courses/resources, language/accessibility, prerequisites, lessons, assessment rubric, progress and completion record; identity-bound credential only for assessed work; explicit skill sharing toggle.

**Avoid:** guaranteeing interviews/employment, inventing eligibility, reselling personal resumes, scraped listings without permission, calling attendance a verified skill, or forcing a course purchase to apply for a job.

## Data and integrations

`employers`, `opportunity_sources`, `opportunities`, `eligibility_rules`, `applications` or external application links, `skills`, `learning_paths`, `course_units`, `assessments`, `skill_evidence`, `credentials`, `saved_opportunities`, notification preferences. EcoAI recommendation can rank only public/current eligible listings. Do not expose full application/resume data to learning or ads.

## Acceptance criteria

- Expired or unverified opportunities are clearly labeled/hidden from “verified”; source and last checked date are present.
- Skill matching explains which verified skills meet a requirement and which are unknown/missing.
- User controls whether a credential/profile skill is shared with an employer.
- Course completion requires its stated assessment criteria; certificate is verifiable and revocable for fraud/error.
- Reported scams have a staff queue and timely delist/escalate mechanism.

## Monetization

Employers may pay for posting/workforce tools; paid placement is labeled and never overrides safety/qualification filters. Learning may have sponsored/free courses and paid certificates, with price/credential terms visible. Applying for a job remains free for candidates.

## Build prompt

> Build Eco Jobs and Eco Learn as two related modules in the existing EcoVibes app, not as a single table or assumed employment guarantee. Read the master plan and current Opportunity/Personalization audit. Start with verified employer and sourced job records plus external application status; then add a small learning path and assessed skill evidence. Use the EcoVibes ID and a narrowly scoped skill-sharing choice. Keep matching explainable, location/country aware and based on records users can access. Do not fabricate jobs, certificates, results or application outcomes. Create server-side moderation/expiration, report flow and source timestamps. Keep candidate applications free; preserve existing navigation and document all country-specific rules as configuration.
