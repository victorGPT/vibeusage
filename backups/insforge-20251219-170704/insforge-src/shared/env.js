'use strict';

function getBaseUrl() {
  return Deno.env.get('INSFORGE_INTERNAL_URL') || 'http://insforge:7130';
}

function getServiceRoleKey() {
  return Deno.env.get('INSFORGE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || null;
}

function getAnonKey() {
  return Deno.env.get('ANON_KEY') || Deno.env.get('INSFORGE_ANON_KEY') || null;
}

module.exports = {
  getBaseUrl,
  getServiceRoleKey,
  getAnonKey
};

