import { describe, it, expect } from 'vitest';
import { canonicalStringify } from '../supabase/functions/_shared/canonical-hash';
import { getSignatureProvider } from '../src/services/signature-provider';

describe('Assinafy Integration Tests', () => {
    it('canonicalStringify gera a mesma saída com chaves em ordens diferentes', () => {
        const obj1 = { a: 1, b: 2, c: { x: 10, y: 20 } };
        const obj2 = { b: 2, c: { y: 20, x: 10 }, a: 1 };
        
        expect(canonicalStringify(obj1)).toBe(canonicalStringify(obj2));
    });

    it('canonicalStringify preserva ordem de arrays', () => {
        const obj1 = { arr: [1, 2, 3] };
        const obj2 = { arr: [1, 3, 2] };
        
        expect(canonicalStringify(obj1)).not.toBe(canonicalStringify(obj2));
    });

    it('evento duplicado gera a mesma chave', () => {
        const payload1 = { event_type: "document.signed", data: { document: { id: "123" } } };
        const payload2 = { data: { document: { id: "123" } }, event_type: "document.signed" };
        
        expect(canonicalStringify(payload1)).toBe(canonicalStringify(payload2));
    });

    it('evento semanticamente diferente gera outra chave', () => {
        const payload1 = { event_type: "document.signed", data: { document: { id: "123" } } };
        const payload2 = { event_type: "document.completed", data: { document: { id: "123" } } };
        
        expect(canonicalStringify(payload1)).not.toBe(canonicalStringify(payload2));
    });

    it('provider zapsign é preservado', () => {
        const provider = getSignatureProvider('zapsign');
        expect(provider.name).toBe('ZapSign');
    });

    it('provider assinafy é selecionado', () => {
        const provider = getSignatureProvider('assinafy');
        expect(provider.name).toBe('assinafy');
        
        const defaultProvider = getSignatureProvider();
        expect(defaultProvider.name).toBe('assinafy');
    });
});

import { decideDispatch } from '../supabase/functions/assinafy-create-doc/logic';
import { StatusHttpError, normalizeAssinafyStatus, validateStatusPayload } from '../supabase/functions/assinafy-status/logic';

describe('Assinafy dispatch state machine', () => {
  const hash = 'a'.repeat(64);
  it('primeiro envio cria uma única solicitação', () => expect(decideDispatch(null, hash).action).toBe('create'));
  it('clique duplo e solicitação existente reutilizam o documento', () => {
    const request = { id: 'req-1', dispatch_status: 'pending_signature', original_file_hash: hash, external_document_id: 'doc-1' };
    expect(decideDispatch(request, hash)).toEqual({ action: 'reuse', request });
    expect(decideDispatch(request, hash).action).toBe('reuse');
  });
  it('nova tentativa reutiliza a solicitação falha', () => expect(decideDispatch({ id: 'req-1', dispatch_status: 'failed', original_file_hash: hash }, hash).action).toBe('retry'));
  it('bloqueia PDF com hash divergente', () => expect(decideDispatch({ id: 'req-1', dispatch_status: 'pending_signature', original_file_hash: 'b'.repeat(64) }, hash).action).toBe('hash_conflict'));
  it('impede duplicação durante processamento', () => expect(decideDispatch({ id: 'req-1', dispatch_status: 'processing', original_file_hash: hash }, hash).action).toBe('processing'));
});

describe('Assinafy status contract', () => {
  it('exige signature_request_id no sync', () => {
    expect(() => validateStatusPayload({ action: 'sync' })).toThrow(StatusHttpError);
    try { validateStatusPayload({ action: 'sync' }); } catch (error) { expect((error as StatusHttpError).status).toBe(400); expect((error as StatusHttpError).code).toBe('signature_request_id_required'); }
  });
  it('normaliza status posterior ao envio', () => {
    expect(normalizeAssinafyStatus('completed')).toBe('signed');
    expect(normalizeAssinafyStatus('sent')).toBe('pending_signature');
  });
});
