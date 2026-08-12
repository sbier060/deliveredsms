/**
 * Shared snippet builders — one source for the landing page, console
 * onboarding, and docs. Placeholders {{API_KEY}} / {{FROM_NUMBER}} are
 * substituted client-side by CodeTabs (key-aware when a session key exists).
 */

export const API_KEY_PLACEHOLDER = '{{API_KEY}}';
export const FROM_PLACEHOLDER = '{{FROM_NUMBER}}';
export const DEFAULT_KEY = 'osms_sk_test_YOUR_KEY';
export const DEFAULT_FROM = '+15005550100';
export const DEFAULT_TO = '+15005550006';

export function buildSendSnippets(): Record<string, string> {
  const key = API_KEY_PLACEHOLDER;
  const from = FROM_PLACEHOLDER;
  const to = DEFAULT_TO;
  return {
    cURL: `curl -X POST https://api.opensms.dev/v1/messages \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "${from}",
    "to": "${to}",
    "body": "Hello from OpenSMS"
  }'`,
    'Node.js': `import { OpenSMS } from 'opensms';

const opensms = new OpenSMS('${key}');

const message = await opensms.messages.send({
  from: '${from}',
  to: '${to}',
  body: 'Hello from OpenSMS',
});

console.log(message.id); // msg_...`,
    Python: `import requests

res = requests.post(
    "https://api.opensms.dev/v1/messages",
    headers={"Authorization": "Bearer ${key}"},
    json={
        "from": "${from}",
        "to": "${to}",
        "body": "Hello from OpenSMS",
    },
)

print(res.json()["id"])  # msg_...`,
    Ruby: `require "net/http"
require "json"

uri = URI("https://api.opensms.dev/v1/messages")
req = Net::HTTP::Post.new(uri)
req["Authorization"] = "Bearer ${key}"
req["Content-Type"] = "application/json"
req.body = {
  from: "${from}",
  to: "${to}",
  body: "Hello from OpenSMS"
}.to_json

res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }
puts JSON.parse(res.body)["id"]`,
    Go: `payload := map[string]string{
    "from": "${from}",
    "to":   "${to}",
    "body": "Hello from OpenSMS",
}
data, _ := json.Marshal(payload)

req, _ := http.NewRequest("POST",
    "https://api.opensms.dev/v1/messages", bytes.NewBuffer(data))
req.Header.Set("Authorization", "Bearer ${key}")
req.Header.Set("Content-Type", "application/json")

res, _ := http.DefaultClient.Do(req)
defer res.Body.Close()`,
  };
}
