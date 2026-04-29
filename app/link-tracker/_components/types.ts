export interface MarketingLink {
    id: string;
    slug: string;
    target_url: string;
    campaign_name: string | null;
    description: string | null;
    click_count: number;
    unique_clicks: number;
    created_at: string;
}
