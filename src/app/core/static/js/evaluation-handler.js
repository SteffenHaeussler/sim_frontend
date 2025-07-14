export class EvaluationHandler {
    constructor(sanitizer) {
        this.sanitizer = sanitizer;
        this.currentSQLContainer = null;
        this.currentEvaluationDiv = null;
        this.inEvaluationMode = false;
    }

    setEvaluationMode(enabled) {
        this.inEvaluationMode = enabled;
    }

    isInEvaluationMode() {
        return this.inEvaluationMode;
    }

    setSQLContainer(container) {
        this.currentSQLContainer = container;
    }

    getSQLContainer() {
        return this.currentSQLContainer;
    }

    addEvaluationToSQLContainer(evaluationText) {
        if (!this.currentSQLContainer) return;
        
        const evaluationDiv = document.createElement('div');
        evaluationDiv.className = 'sql-evaluation-section';
        evaluationDiv.innerHTML = `
            <div class="sql-evaluation-header">
                <h4>Evaluation</h4>
            </div>
            <div class="sql-evaluation-content">
                ${this.sanitizer.sanitize(marked.parse(evaluationText))}
            </div>
        `;
        
        this.currentSQLContainer.appendChild(evaluationDiv);
        this.currentEvaluationDiv = evaluationDiv.querySelector('.sql-evaluation-content');
    }

    appendToEvaluation(text) {
        if (!this.currentEvaluationDiv) return;
        
        const currentContent = this.currentEvaluationDiv.textContent;
        const parsedEvaluation = marked.parse(currentContent + '\n' + text);
        this.currentEvaluationDiv.innerHTML = this.sanitizer.sanitize(parsedEvaluation);
    }

    hasCurrentEvaluationDiv() {
        return this.currentEvaluationDiv !== null;
    }

    reset() {
        this.currentSQLContainer = null;
        this.currentEvaluationDiv = null;
        this.inEvaluationMode = false;
    }
}