# Pilot Scene to Spec Mapping v0.2

## Pilot Scene

- scene.order.query
- domain: erp
- intent: retrieve order status and fulfillment snapshot quickly and safely

## Scene Graph

- scene.order.query -> uses -> spec.erp.order-query-service
- scene.order.query -> uses -> spec.erp.order-fulfillment-snapshot
- scene.order.query -> constrained_by -> policy.erp.read-low-risk
- scene.order.query -> constrained_by -> datacontract.erp.order-query
- scene.order.query -> evaluated_by -> eval.erp.order-query-quality

## Capability Mapping Table

| Scene Step | Required Capability Spec | Current State | Gap |
| --- | --- | --- | --- |
| Resolve input and validate orderId | spec.erp.order-query-service | defined in contract draft | implement runtime binding |
| Query order header state | spec.erp.order-query-service | defined in contract draft | implement adapter execution |
| Query fulfillment snapshot | spec.erp.order-fulfillment-snapshot | defined in contract draft | add evidence mapping |
| Apply policy gate | policy.erp.read-low-risk | defined | integrate in runtime gate |
| Produce response and evidence | eval.erp.order-query-quality | defined | implement scoring in runtime |

## Gap Summary

- Missing execution runtime to compile and dispatch Plan IR.
- Missing adapter implementation for contract binding resolution.
- Missing standardized evidence emission hook in runtime executor.

## Follow-up

- Address gaps in spec 37-00-scene-runtime-execution-pilot.
