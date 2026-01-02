Technical Specification: AI-Powered Torrent Selection & Scene Discovery Engine
1. Objective
Build a Whisparr-like intelligent torrent selection engine for adult content. The system must use a Cross-Encoder AI model to match Prowlarr results against metadata, handle truncated titles, and implement a "Scene Discovery" logic for content that doesn't yet have metadata.
2. Core Components & Stack
Language: Python
AI Model: cross-encoder/ms-marco-MiniLM-L-6-v2 (via sentence-transformers)
Search Provider: Prowlarr API
Database Entity Relationship: Performer, Studio, Scene, Subscription (Quality Profiles).
3. Data Structures
Quality Profile (Priority List)
Matches must follow a strict hierarchy defined by the user (e.g., 1080p.Bluray > 1080p.WebDL > 720p.WebDL).
Meta Entity (Target)
code
JSON
{
  "performer": "Jane Doe",
  "studio": "X-Studio",
  "date": "2024-11-03",
  "title": "The Big Adventure"
}
4. Search & Selection Pipeline
Phase 1: Performer-Based Search (The "Discovery" Phase)
Query: Send performer name to Prowlarr.
Preprocessing: Parse torrent titles using Regex to extract: Quality, Resolution, Studio, and Date.
AI Matching (The Decision Maker):
For each torrent, construct a Contextual String:
Target: [Performer] | [Studio] | [Date] | [Title]
Torrent: [Title] | [Prowlarr_Category]
Score the pair using the Cross-Encoder.
Threshold: Score > 0.70 = Matched with Meta. Score < 0.40 = Unknown Content.
Selection: From matches, pick the highest quality according to the profile. If multiple, pick the one with most seeders.
Discovery Logic (Grouping):
For results with low AI scores: Group torrents that have similar titles across different indexers.
If a group appears more than N times, create a "Placeholder Scene" in the DB: [Performer] - Unknown Scene (Parsed Title Snippet).
Mark for download if it meets quality criteria.
Phase 2: Studio-Based Search
Query: Send studio name to Prowlarr.
Filtering: Exclude scenes already found/downloaded in Phase 1.
AI Matching: Apply the same Cross-Encoder logic.
Discovery: Identify scenes belonging to the studio that were not in the meta-service.
Phase 3: Targeted Scene Search (The "Specific" Phase)
Query: For scenes in the DB that are still "Missing", trigger a specific Studio + Title or Performer + Title query.
AI Matching: Tighten the threshold (Score > 0.85) since this is a targeted search.
5. Implementation Details for AI Logic
Cross-Encoder Integration
code
Python
from sentence_transformers import CrossEncoder

model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

def get_match_score(target_meta, torrent_title):
    # Constructing the multi-signal context as discussed
    query = f"Performer: {target_meta.performer} | Studio: {target_meta.studio} | Date: {target_meta.date} | Title: {target_meta.title}"
    document = f"Torrent: {torrent_title}"
    
    score = model.predict([(query, document)])[0]
    return score
6. Business Logic Rules
Truncated Title Handling: The Cross-Encoder must prioritize Studio and Performer signals when the Title part of the torrent string is cut off (e.g., "Jane.Doe.Big.Adv...").
Quality Priority: Never download a lower quality if a higher quality from the profile is available and has > 1 seeder.
Seeder Floor: Ignore torrents with 0 seeders unless they are very recent (< 24h).
De-duplication: If a scene is identified via "Discovery" and later a Meta-service update provides the real title, merge the records using the AI score as a bridge.
7. Claude Code Instructions
Implement the TorrentSelector class.
Use re for aggressive parsing of quality tags (1080p, 2160p, x264, etc.).
Create a scoring function that weights the Cross-Encoder output alongside Seeder count and Quality rank.
Implement the "Group-by-Title" logic for discovery of non-meta scenes.