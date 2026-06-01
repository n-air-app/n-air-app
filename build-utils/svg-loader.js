/**
 * Minimal SVG loader for Vue 3 + webpack 5.
 * Wraps an SVG file as a Vue SFC template so vue-loader 17 can compile it.
 * Replaces vue-svg-loader (Vue 2 only) with a Vue 3 compatible equivalent.
 */
module.exports = function vue3SvgLoader(source) {
  return `<template>${source}</template>`;
};
