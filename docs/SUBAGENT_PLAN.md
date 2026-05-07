# Subagent Plan

Bu liste, roadmap'in fazlarina gore en fazla deger uretecek subagentlari secer. Amac otomatik delegation degil; ihtiyac dogdugunda bilincli sekilde dogru uzmanligi cagirmaktir.

## Core Orchestration

| Subagent | Ne Zaman | Neden |
| --- | --- | --- |
| `project-manager` | Tum fazlarda | Faz sirasini, blokajlari ve teslimleri takip etmek icin |
| `multi-agent-coordinator` | Paralel analiz/uygulama anlarinda | Birden fazla ajan arasinda gorev dagitimi yapmak icin |
| `task-distributor` | Faz 7+ | Modul bazli isi ayrismak icin |
| `knowledge-synthesizer` | Legacy audit sonrasi | Ekran, veri modeli ve muhasebe kurallarini tek yerde toplamak icin |

## Analysis And Legacy Intake

| Subagent | Fazlar | Neden |
| --- | --- | --- |
| `legacy-modernizer` | 0, 1, 6 | Legacy kaynaklari okuyup web tasima risklerini cikarmak icin |
| `code-mapper` | 1 | Entry point, moduller ve kod akisini cikarmak icin |
| `business-analyst` | 1, 2 | Modulleri ve is akislarini dokumante etmek icin |
| `docs-researcher` | 1, 13, 19 | Legacy davranis ve rapor notlarini toplamak icin |
| `technical-writer` | 0, 1, 2, 19 | Audit ve parity dokumanlarini netlestirmek icin |

## Web App Foundation

| Subagent | Fazlar | Neden |
| --- | --- | --- |
| `nextjs-developer` | 3, 5, 6 | Next.js app iskeleti, route yapisi ve layout icin |
| `typescript-pro` | 3+ | Tip guvenli domain ve API katmani icin |
| `frontend-developer` | 3, 6, 15 | Legacy'ye sadik ekranlarin uygulanmasi icin |
| `backend-developer` | 3+ | API route, servis ve transaction sinirlari icin |
| `api-designer` | 5, 7+ | Modul endpoint kontratlarini netlestirmek icin |

## Data And Accounting Safety

| Subagent | Fazlar | Neden |
| --- | --- | --- |
| `postgres-pro` | 4, 14, 18 | PostgreSQL semasi, indexler ve migration guvenligi icin |
| `database-administrator` | 4, 14, 18 | Veri butunlugu, backup ve operasyonel DB kararlar icin |
| `fintech-engineer` | 4, 8, 10, 11, 12, 16 | Finansal dogruluk ve audit mantigi icin |
| `sql-pro` | 4, 13, 14 | Rapor ve migration sorgulari icin |

## Security And Operations

| Subagent | Fazlar | Neden |
| --- | --- | --- |
| `security-engineer` | 5, 17 | Auth, session, role ve route korumasi icin |
| `security-auditor` | 17, 19 | Son guvenlik gecisi icin |
| `devops-engineer` | 18 | Docker, reverse proxy ve deployment akisi icin |
| `docker-expert` | 18 | Container yapisini saglamlastirmak icin |
| `deployment-engineer` | 18 | Production rollout ve env kurgusu icin |

## Testing And Review

| Subagent | Fazlar | Neden |
| --- | --- | --- |
| `qa-expert` | 7+ | Kabul kriterleri ve regression riskleri icin |
| `test-automator` | 7, 10, 12, 16 | Unit, integration, parity testleri icin |
| `reviewer` | Tum implementasyon fazlari | Risk odakli son gozden gecirme icin |
| `code-reviewer` | PR/commit oncesi | Hata ve davranis regresyonlarini yakalamak icin |
| `risk-manager` | 0, 10, 12, 14, 19 | Yuksek riskli finansal gecislerde karar destegi icin |

## Phase-To-Subagent Quick Map

- Faz 0-2: `project-manager`, `legacy-modernizer`, `code-mapper`, `business-analyst`, `technical-writer`
- Faz 3-6: `nextjs-developer`, `frontend-developer`, `backend-developer`, `typescript-pro`, `postgres-pro`
- Faz 7-13: `fintech-engineer`, `backend-developer`, `frontend-developer`, `qa-expert`, `test-automator`
- Faz 14-19: `database-administrator`, `sql-pro`, `security-engineer`, `devops-engineer`, `reviewer`

## Current Recommendation

Bugunku repo durumunda en kritik besli:

1. `project-manager`
2. `legacy-modernizer`
3. `technical-writer`
4. `nextjs-developer`
5. `postgres-pro`

Sebep: Legacy henüz gelmedigi icin once plan, audit sistemi ve guvenli web iskeleti en fazla ilerleme saglar.
