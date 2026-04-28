<script setup lang="ts">
// Redirect / → /:browserLanguage or /nl
const lang
  = typeof navigator === 'undefined' ? 'nl' : (navigator.language.split('-')[0] ?? 'nl');
await navigateTo(`/${lang}`, { replace: true });
</script>
