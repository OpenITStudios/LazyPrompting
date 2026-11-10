# Durable response evaluation queue

A terminal response can be verified and removed from the prompt outbox before its semantic evaluation completes. DurableEvaluationQueue stores a minimal (workspace, session, response) identity to support idempotent later evaluation. It does not store transcript text, GitHub data or user task context.

The trusted response observer and evaluation worker must enqueue before closing the response outbox entry, or reconcile missing queue entries on restart. This module alone does not make those two stores atomic. Only a trusted evaluator may mark an entry complete. No native tests or live ChatGPT transport have been run.
