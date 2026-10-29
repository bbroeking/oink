/* global document, window */
import React from 'react';
import { createRoot } from 'react-dom/client';
import CardExperience from '../../../components/prototypes/card-packs/CardExperience';
import HalloweenGalleryPage from '../../../components/prototypes/card-packs/HalloweenGalleryPage';
const gallery = new URLSearchParams(window.location.search).get('view') === 'halloween';
createRoot(document.getElementById('root')).render(gallery
  ? <HalloweenGalleryPage onBack={() => { window.location.href = '/'; }}/>
  : <CardExperience/>);
