# Security policy

## Supported versions and scope

Security reports are welcome for the v1.x client application and this repository.
The ElevenLabs agent configuration is managed outside this repository and is outside
its scope.

## Reporting a vulnerability

Please use GitHub private vulnerability reporting for this repository's security
issues. Include the affected version, impact, and enough detail for the maintainer to
investigate. Do not disclose credentials or sensitive details in a public issue.
Use the same private channel to report abuse of a public agent or its quota.

## Credentials and public agents

An ElevenLabs public agent ID is public by design. It can be supplied in Settings or
through `?agent_id=`; it is not an API credential. An exposed agent can nevertheless
consume usage quota. The owner should restrict allowed domains and usage quotas in
the ElevenLabs dashboard.

API keys must never be stored in this repository or shipped to the client. Keep them
server-side and use a server-generated signed URL when authenticated access is
required. Never commit environment files, private keys, or credentials.

## Embedding

The embed bridge accepts inbound messages only from the direct parent of a framed
widget and from a trusted origin. Configure parent origins with `?parent_origin=`
(comma-separated); without an allowlist, only the widget's own origin is trusted.
The document referrer does not grant trust, and messages cannot change the agent.
The `?allow_any_origin=1` escape hatch works only in development builds and still
requires the direct parent as the message source. Outbound messages target trusted
origins; after a trusted message, replies target its exact origin.
