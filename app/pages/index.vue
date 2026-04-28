<script setup lang="ts">
// Redirect / → /:browserLanguage or /nl
const lang =
  typeof navigator !== 'undefined' ? (navigator.language.split('-')[0] ?? 'nl') : 'nl';
await navigateTo(`/${lang}`, { replace: true });
</script>
