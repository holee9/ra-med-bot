-- Migration: 0026_chat_query_audit_action.sql
-- Adds 'chat.query' to the audit_action enum for E2E test audit writes.
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'chat.query';
