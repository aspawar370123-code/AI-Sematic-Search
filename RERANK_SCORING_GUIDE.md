# Rerank Scoring Guide

## How Jina Reranker Scores Work

### Raw Rerank Score Ranges (from Jina model)
- **< 0**: Not relevant / Off-topic
- **0 to 0.2**: Weak relevance (mentions topic but not focused)
- **0.2 to 0.4**: Moderate relevance (related content)
- **0.4 to 0.6**: Good relevance (answers part of query)
- **0.6 to 0.8**: Strong relevance (directly answers query)
- **> 0.8**: Excellent relevance (perfect match)

### Displayed Percentage (User-Facing)
The system converts raw scores to intuitive percentages:

| Raw Rerank Score | Displayed % | Interpretation |
|-----------------|-------------|----------------|
| < 0 | 0% | Not relevant |
| 0.0 | 50% | Neutral/Tangential |
| 0.1 | 54% | Slightly relevant |
| 0.2 | 58% | Moderately relevant |
| 0.33 | 65% | Good match ✓ |
| 0.5 | 74% | Strong match |
| 0.67 | 81% | Very strong match |
| 0.8 | 87% | Excellent match |
| 1.0 | 95% | Near-perfect match |

### Display Threshold
- Documents must score **≥55%** (rerank ≥0.1) to be shown
- This filters out weak/irrelevant matches
- Ensures users only see truly relevant results

### Key Points
1. **Dynamic Scoring**: Each query gets different scores based on actual relevance
2. **No Artificial Inflation**: Scores reflect absolute relevance, not relative ranking
3. **Multiple Results**: If 3 docs score 65%, 72%, 81%, all are shown with their true scores
4. **Quality Filter**: 55% threshold ensures quality results

### Example Scenarios

**Scenario 1: Perfect Match**
- Query: "What is Academic Bank of Credits?"
- Doc about ABC: Rerank 0.75 → Display 84%
- Other docs filtered out (below 55%)

**Scenario 2: Multiple Relevant Docs**
- Query: "UGC regulations 2023"
- Doc A: Rerank 0.65 → Display 80%
- Doc B: Rerank 0.45 → Display 72%
- Doc C: Rerank 0.35 → Display 66%
- All shown with their individual scores

**Scenario 3: Weak Match**
- Query: "Quantum physics in education"
- Best doc: Rerank 0.15 → Display 56%
- Shows with warning that match is weak
