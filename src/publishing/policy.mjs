const CHANNEL_MODES = {
  telegram: 'api_or_owned',
  website: 'api_or_owned',
  whatsapp: 'human_assisted',
  facebook: 'human_assisted',
  linkedin: 'human_assisted',
  classified: 'human_assisted',
};

export function buildPublicationJob({ contentVariantId, channel, destination, approved = false }) {
  const mode = CHANNEL_MODES[channel] ?? 'human_assisted';
  return {
    content_variant_id: contentVariantId,
    channel,
    destination: destination ?? null,
    status: approved ? 'queued' : 'blocked_review',
    requires_human: mode === 'human_assisted',
    payload: { channel_mode: mode },
  };
}
