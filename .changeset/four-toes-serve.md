---
"@apollo/client": major
---

HTTP Multipart handling will now throw an error if the connection closed before the final boundary has been received.
Data after the final boundary will be ignored.
