import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import ModalLayout from '../shared/ModalLayout.vue';

@Component({ components: { ModalLayout } })
export default class Blank extends Vue {}
