(function () {
	"use strict";

	const storageKey = "tickle-the-pig:barn-background-preview:v2";
	const form = document.querySelector("#background-form");
	const radios = Array.from(form.querySelectorAll('input[name="background"]'));
	const chooseButton = document.querySelector("#choose-button");
	const status = document.querySelector("#selection-status");
	const resourceLinks = [
		document.querySelector("#open-image"),
		document.querySelector("#download-image"),
	];

	function setResourceLinks(radio) {
		resourceLinks.forEach((link) => {
			link.href = radio.dataset.src;
			link.removeAttribute("aria-disabled");
		});
		resourceLinks[0].target = "_blank";
		resourceLinks[0].rel = "noopener";
		resourceLinks[1].download = radio.dataset.src.split("/").pop();
	}

	function preview(radio, confirmed) {
		const title = radio.dataset.title;
		chooseButton.disabled = false;
		chooseButton.textContent = `Choose ${title}`;
		setResourceLinks(radio);
		status.textContent = confirmed
			? `${title} — Selected for this preview.`
			: `${title} is ready to preview. Choose it to confirm this preview.`;
	}

	radios.forEach((radio) => {
		radio.addEventListener("change", () => preview(radio, false));
	});

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		const selected = radios.find((radio) => radio.checked);
		if (!selected) return;
		try {
			localStorage.setItem(storageKey, selected.value);
		} catch (_error) {
			// The confirmed choice still applies to this open preview when storage is unavailable.
		}
		preview(selected, true);
	});

	let savedValue = null;
	try {
		savedValue = localStorage.getItem(storageKey);
	} catch (_error) {
		// Browsers may block storage for local files; the chooser remains fully usable.
	}
	const savedRadio = radios.find((radio) => radio.value === savedValue);
	if (savedRadio) {
		savedRadio.checked = true;
		preview(savedRadio, true);
	}
})();
