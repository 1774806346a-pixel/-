CREATE TRIGGER IF NOT EXISTS prevent_source_document_update
BEFORE UPDATE ON source_documents
BEGIN
  SELECT RAISE(ABORT, 'source documents are immutable');
END;

CREATE TRIGGER IF NOT EXISTS prevent_source_document_delete
BEFORE DELETE ON source_documents
BEGIN
  SELECT RAISE(ABORT, 'source documents are immutable');
END;
