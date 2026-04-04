/**
 * Patient Home Tab — Vitals + Intakes + Medication
 */
import React, { useState } from 'react';
import VitalsCard from './VitalsCard';
import IntakesCard from './IntakesCard';
import MedicationCard from './MedicationCard';
import UrineOutputModal from './UrineOutputModal';

const PatientHome: React.FC = () => {
  const [showUrineModal, setShowUrineModal] = useState(false);

  return (
    <>
      <div className="pa-content">
        <VitalsCard onOpenUrineModal={() => setShowUrineModal(true)} />
        <IntakesCard />
        <MedicationCard />
      </div>

      <UrineOutputModal
        isOpen={showUrineModal}
        onClose={() => setShowUrineModal(false)}
      />
    </>
  );
};

export default PatientHome;
