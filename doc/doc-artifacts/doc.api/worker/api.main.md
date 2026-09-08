> **Entry:** Worker only.

# `api.main`

## Methods

### `emitEvent(eventName, payload?): void`

| Param | Type | Description |
|---|---|---|
| `eventName` | `string` | Event to send toward main |
| `payload` | any optional | Data |

Use when worker sim logic must trigger main-only UI/audio.
