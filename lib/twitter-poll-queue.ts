// lib/twitter-poll-queue.ts
// Azure Table Storage queue for AI-generated Twitter polls pending human review.
//
// Table: TwitterPollQueue
//   PartitionKey: 'poll'
//   RowKey:       nanoid
//
// Status flow:  pending_review → approved → posted
//                              → rejected

import { getTableClient, ensureTable } from './azure-tables';

const TABLE = 'TwitterPollQueue';

export type PollStatus = 'pending_review' | 'approved' | 'rejected' | 'posted';
export type PollAngle  = 'directional' | 'comparative' | 'sentiment';

export interface TwitterPoll {
    id:            string;
    status:        PollStatus;
    question:      string;   // max 140 chars (Twitter limit)
    options:       string[]; // 2–4 choices, each max 25 chars (Twitter limit)
    hashtags:      string[]; // without # prefix
    cashtags:      string[]; // without $ prefix
    angle:         PollAngle;
    topicKey:      string;   // dedup slug e.g. "eurusd-directional"
    rationale:     string;   // internal note — never posted
    headlines:     string[]; // news headlines used as AI context
    events:        string[]; // econ calendar events used as AI context
    createdAt:     string;   // ISO
    scheduledFor?: string;
    postedAt?:     string;
}

interface PollEntity {
    partitionKey: string; rowKey: string;
    status: PollStatus; question: string;
    optionsJson: string; hashtagsJson: string; cashtagsJson: string;
    angle: PollAngle; topicKey: string; rationale: string;
    headlinesJson: string; eventsJson: string; createdAt: string;
    scheduledFor?: string; postedAt?: string;
}

function toEntity(p: TwitterPoll): PollEntity {
    return {
        partitionKey: 'poll', rowKey: p.id,
        status: p.status, question: p.question,
        optionsJson:   JSON.stringify(p.options),
        hashtagsJson:  JSON.stringify(p.hashtags),
        cashtagsJson:  JSON.stringify(p.cashtags),
        angle: p.angle, topicKey: p.topicKey, rationale: p.rationale,
        headlinesJson: JSON.stringify(p.headlines),
        eventsJson:    JSON.stringify(p.events),
        createdAt: p.createdAt,
        ...(p.scheduledFor && { scheduledFor: p.scheduledFor }),
        ...(p.postedAt     && { postedAt:     p.postedAt }),
    };
}

function fromEntity(e: PollEntity): TwitterPoll {
    return {
        id: e.rowKey, status: e.status, question: e.question,
        options:   JSON.parse(e.optionsJson   || '[]'),
        hashtags:  JSON.parse(e.hashtagsJson  || '[]'),
        cashtags:  JSON.parse(e.cashtagsJson  || '[]'),
        angle: e.angle, topicKey: e.topicKey, rationale: e.rationale || '',
        headlines: JSON.parse(e.headlinesJson || '[]'),
        events:    JSON.parse(e.eventsJson    || '[]'),
        createdAt: e.createdAt,
        scheduledFor: e.scheduledFor,
        postedAt:     e.postedAt,
    };
}

export const PollQueue = {
    async save(poll: TwitterPoll): Promise<void> {
        const client = getTableClient(TABLE);
        await ensureTable(TABLE);
        await client.createEntity(toEntity(poll));
    },

    async updateStatus(id: string, status: PollStatus, extra?: { scheduledFor?: string }): Promise<void> {
        await getTableClient(TABLE).updateEntity(
            { partitionKey: 'poll', rowKey: id, status, ...extra }, 'Merge'
        );
    },

    async list(status: PollStatus): Promise<TwitterPoll[]> {
        const client = getTableClient(TABLE);
        const results: TwitterPoll[] = [];
        const iter = client.listEntities<PollEntity>({
            queryOptions: { filter: `PartitionKey eq 'poll' and status eq '${status}'` },
        });
        for await (const e of iter) results.push(fromEntity(e));
        return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    async recentTopicKeys(daysBack = 7): Promise<Set<string>> {
        const since = new Date();
        since.setDate(since.getDate() - daysBack);
        const keys = new Set<string>();
        try {
            const iter = getTableClient(TABLE).listEntities<PollEntity>({
                queryOptions: { filter: `PartitionKey eq 'poll' and createdAt ge '${since.toISOString()}'` },
            });
            for await (const e of iter) if (e.topicKey) keys.add(e.topicKey);
        } catch { /* table may not exist on first run */ }
        return keys;
    },
};
