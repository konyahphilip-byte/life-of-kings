# TAX-01 architecture
Use the accepted isolated taxonomy scope and ADR-005. This is a pure shared contract layered on exact PR61 head9967875. No new service or auth/storage system.
Tests were written first: the retained red JSON has17 legacy assertions passing and the new registry suite failing to resolve the unimplemented module. Persisted IDs survive renaming/reparenting; aliases are suggestions only; field schemas cannot infer ownership, certification or publication permission. Publication remains server-governed and narrow.
